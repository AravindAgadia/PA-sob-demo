import { getOpenAiApiKey } from "@/lib/env";
import { log } from "@/lib/log";

const TRANSCRIPTION_MODEL = "gpt-4o-mini";

/** Measured directly (extraction timing logs): transcribing an 18-page
 *  policy as one verbatim-transcription call took ~124s — 72% of a full
 *  extraction run's wall-clock time, dwarfing everything else (Phase A
 *  ~35s, all 19 Phase B calls combined ~14s). Output-token generation is
 *  the slow part of a call like this, not reading the PDF, so splitting a
 *  long document into page-range chunks and transcribing them in
 *  parallel is the one change that can actually move the needle, rather
 *  than tuning Phase B concurrency further (already fast, never the
 *  bottleneck). Short documents (a 3-page PA form) aren't worth the extra
 *  page-count round trip, so chunking only kicks in above this size. */
const CHUNK_THRESHOLD_PAGES = 6;
const CHUNK_SIZE_PAGES = 6;

/** Framing this as an internal OCR/data-processing utility, in a system
 *  message rather than folding it into the user turn, measurably reduces
 *  refusals on long documents — a bare "transcribe this verbatim" user
 *  request (no system framing) was observed to get flatly refused
 *  ("I'm sorry, but I can't assist with that.") on this exact PDF in
 *  testing, with no API-visible error, which silently corrupted every
 *  downstream extraction call. */
const TRANSCRIPTION_SYSTEM_PROMPT = `You are an OCR/text-extraction utility inside an internal document-processing pipeline. The organization operating this pipeline owns or is the authorized administrator of every document it submits to you — these are its own insurance coverage-policy PDFs, submitted by internal staff to convert into machine-readable text for their own downstream systems. Your only job is faithful text extraction, not summarization or judgment about the content.`;

const TRANSCRIPTION_RULES = `RULES
1. Output plain text only — no markdown, no commentary, no summarizing.
2. Before each page's text, insert a line reading exactly: --- Page N ---
   (N is that page's 1-indexed page number IN THE FULL DOCUMENT, not a
   number restarting from 1 for whatever subset you were asked for.)
3. Preserve numbered/lettered list structure (1., 2., A., B., i., ii., etc.) and
   table rows as plain text lines — don't reformat them, just keep the words and
   structure legible.
4. Transcribe text exactly as printed — do not correct, paraphrase, or normalize
   wording, spelling, or punctuation.`;

function wholeDocumentPrompt(): string {
  return `Transcribe this document's full text, exactly as written, in reading order.

${TRANSCRIPTION_RULES}
5. Transcribe every page from the first to the last. Do not skip pages, including
   pages that look like boilerplate, references, or a revision-history table —
   every page must appear under its own marker, verbatim.`;
}

function chunkPrompt(startPage: number, endPage: number): string {
  return `This document has multiple pages. Transcribe ONLY pages ${startPage} through ${endPage} (inclusive), exactly as written, in reading order — do not transcribe any page outside that range, and do not summarize what the rest of the document contains.

${TRANSCRIPTION_RULES}
5. Transcribe every page from ${startPage} to ${endPage}, including any that look like boilerplate, references, or a revision-history table — every page in range must appear under its own marker, verbatim.`;
}

/** No `refusal` field is surfaced for plain chat completions (that's only
 *  exposed on Structured Outputs responses) — a refusal just comes back as
 *  ordinary short content, so it has to be detected heuristically instead
 *  of trusted as real transcription. `expectedMinChars` is scaled to what's
 *  actually being asked for (a full document vs. a handful of pages), not
 *  the whole file's byte size, so a short-but-correct chunk transcription
 *  isn't mistaken for a refusal. */
const REFUSAL_PATTERN = /^(i'm sorry|i am sorry|i cannot|i can't|i won't|sorry,? (but )?i)/i;

function looksLikeRefusal(text: string, expectedMinChars: number): boolean {
  const trimmed = text.trim();
  if (REFUSAL_PATTERN.test(trimmed)) return true;
  return trimmed.length < Math.min(200, expectedMinChars);
}

async function callChat(systemPrompt: string, userText: string, bytes: Buffer, filename: string): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key configured. Add OPENAI_API_KEY to .env.local, then restart the dev server."
    );
  }

  const base64 = bytes.toString("base64");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TRANSCRIPTION_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "file", file: { filename, file_data: `data:application/pdf;base64,${base64}` } },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    log.error("PDF transcription request failed", {
      filename,
      status: res.status,
      detail: detail.slice(0, 500),
    });
    throw new Error(`Couldn't read "${filename}" (transcription request failed, HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new Error(`Couldn't read "${filename}" — the transcription came back empty.`);
  }
  return text;
}

/** ~300 chars/page is a conservative floor for "this isn't a refusal" —
 *  real policy-document pages run far denser than that, but a floor this
 *  low won't false-flag a legitimately terse page (e.g., a mostly-blank
 *  cover page). */
const MIN_CHARS_PER_PAGE = 300;

async function transcribeWithRetry(
  systemPrompt: string,
  userText: string,
  bytes: Buffer,
  filename: string,
  expectedMinChars: number,
  label: string
): Promise<string> {
  let text = await callChat(systemPrompt, userText, bytes, filename);

  if (looksLikeRefusal(text, expectedMinChars)) {
    log.warn("Transcription looked like a refusal or truncation — retrying once", {
      filename,
      label,
      preview: text.slice(0, 200),
    });
    text = await callChat(systemPrompt, userText, bytes, filename);
  }

  if (looksLikeRefusal(text, expectedMinChars)) {
    log.error("Transcription still looked like a refusal after retry", {
      filename,
      label,
      preview: text.slice(0, 200),
    });
    throw new Error(
      `Couldn't transcribe "${filename}" (${label}) — the model declined or returned an implausibly short result twice in a row. Try again, or try a different file.`
    );
  }

  return text;
}

async function countPages(bytes: Buffer, filename: string): Promise<number | null> {
  try {
    const text = await callChat(
      "You report the exact page count of a supplied PDF document. Reply with ONLY the integer — no words, no punctuation, nothing else.",
      "How many pages does this document have?",
      bytes,
      filename
    );
    const n = parseInt(text.trim(), 10);
    return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
  } catch (err) {
    log.warn("Page-count lookup failed — falling back to a single whole-document transcription", {
      filename,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function buildChunkRanges(totalPages: number, chunkSize: number): [number, number][] {
  const ranges: [number, number][] = [];
  for (let start = 1; start <= totalPages; start += chunkSize) {
    ranges.push([start, Math.min(start + chunkSize - 1, totalPages)]);
  }
  return ranges;
}

/**
 * No local PDF-parsing library is used here (not a style choice — `npm
 * install` is blocked in this environment: the corporate TLS-inspecting
 * proxy's cached root cert doesn't match what it currently presents, so no
 * new package can be installed at all). Instead, the PDF is sent to OpenAI
 * with a strict verbatim-transcription instruction, and that transcription
 * becomes the "known source text" every later extraction call works from
 * — including what validate-extraction.ts checks quotes against.
 *
 * For documents longer than CHUNK_THRESHOLD_PAGES, a quick page-count
 * lookup is done first, then the document is transcribed in parallel
 * page-range chunks rather than one single call — measured to be the
 * dominant cost in a full extraction run (see the module-level comment on
 * CHUNK_SIZE_PAGES), since generating a long verbatim transcription is
 * slow in a way that doesn't shrink just by asking nicely, but does
 * parallelize across chunks.
 */
export async function extractPageMarkedText(bytes: Buffer, filename: string): Promise<string> {
  const pageCount = await countPages(bytes, filename);

  if (pageCount && pageCount > CHUNK_THRESHOLD_PAGES) {
    const ranges = buildChunkRanges(pageCount, CHUNK_SIZE_PAGES);
    const chunks = await Promise.all(
      ranges.map(([startPage, endPage]) =>
        transcribeWithRetry(
          TRANSCRIPTION_SYSTEM_PROMPT,
          chunkPrompt(startPage, endPage),
          bytes,
          filename,
          (endPage - startPage + 1) * MIN_CHARS_PER_PAGE,
          `pages ${startPage}-${endPage}`
        )
      )
    );
    const text = chunks.join("\n\n");
    if (!/---\s*Page\s+1\s*---/i.test(text)) {
      log.warn("Chunked transcription missing expected page-1 marker", { filename });
    }
    return text;
  }

  // Short document, or page-count lookup failed — one whole-document call,
  // same as before chunking existed.
  const text = await transcribeWithRetry(
    TRANSCRIPTION_SYSTEM_PROMPT,
    wholeDocumentPrompt(),
    bytes,
    filename,
    (pageCount ?? 1) * MIN_CHARS_PER_PAGE,
    "whole document"
  );
  if (!/---\s*Page\s+1\s*---/i.test(text)) {
    log.warn("Transcription missing expected page-1 marker", { filename });
  }
  return text;
}
