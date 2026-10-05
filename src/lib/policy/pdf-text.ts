import { getOpenAiApiKey } from "@/lib/env";
import { log } from "@/lib/log";

const TRANSCRIPTION_MODEL = "gpt-4o-mini";

/** Framing this as an internal OCR/data-processing utility, in a system
 *  message rather than folding it into the user turn, measurably reduces
 *  refusals on long documents — a bare "transcribe this verbatim" user
 *  request (no system framing) was observed to get flatly refused
 *  ("I'm sorry, but I can't assist with that.") on this exact PDF in
 *  testing, with no API-visible error, which silently corrupted every
 *  downstream extraction call. */
const TRANSCRIPTION_SYSTEM_PROMPT = `You are an OCR/text-extraction utility inside an internal document-processing pipeline. The organization operating this pipeline owns or is the authorized administrator of every document it submits to you — these are its own insurance coverage-policy PDFs, submitted by internal staff to convert into machine-readable text for their own downstream systems. Your only job is faithful text extraction, not summarization or judgment about the content.`;

const TRANSCRIPTION_PROMPT = `Transcribe this document's full text, exactly as written, in reading order.

RULES
1. Output plain text only — no markdown, no commentary, no summarizing.
2. Before each page's text, insert a line reading exactly: --- Page N ---
   (N is that page's 1-indexed page number in this document, starting at 1.)
3. Transcribe every page from the first to the last. Do not skip pages, including
   pages that look like boilerplate, references, or a revision-history table —
   every page must appear under its own marker, verbatim.
4. Preserve numbered/lettered list structure (1., 2., A., B., i., ii., etc.) and
   table rows as plain text lines — don't reformat them, just keep the words and
   structure legible.
5. Transcribe text exactly as printed — do not correct, paraphrase, or normalize
   wording, spelling, or punctuation.`;

/** No `refusal` field is surfaced for plain chat completions (that's only
 *  exposed on Structured Outputs responses) — a refusal just comes back as
 *  ordinary short content, so it has to be detected heuristically instead
 *  of trusted as real transcription. */
const REFUSAL_PATTERN = /^(i'm sorry|i am sorry|i cannot|i can't|i won't|sorry,? (but )?i)/i;

function looksLikeRefusal(text: string, fileSizeBytes: number): boolean {
  const trimmed = text.trim();
  if (REFUSAL_PATTERN.test(trimmed)) return true;
  // A real multi-page PDF transcribes to far more text than its own byte
  // size in characters is an upper bound for "suspiciously short" — a
  // few-hundred-KB PDF collapsing to a one-line response is never a
  // legitimate full transcription.
  return trimmed.length < 200 && fileSizeBytes > 20_000;
}

/**
 * No local PDF-parsing library is used here (not a style choice this time —
 * `npm install` is blocked in this environment: the corporate TLS-inspecting
 * proxy's cached root cert doesn't match what it currently presents, so no
 * new package can be installed at all). Instead, the PDF is sent to OpenAI
 * once with a strict verbatim-transcription instruction, and that
 * transcription becomes the "known source text" every later extraction call
 * works from — including what validate-extraction.ts checks quotes against.
 * Less mechanically rigid than a local parser, but it keeps the pipeline
 * fully dependency-free and gives every later step real, page-marked text
 * instead of opaquely re-reading the raw PDF bytes per call.
 */
async function callTranscription(bytes: Buffer, filename: string): Promise<string> {
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
        { role: "system", content: TRANSCRIPTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: { filename, file_data: `data:application/pdf;base64,${base64}` },
            },
            { type: "text", text: TRANSCRIPTION_PROMPT },
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

export async function extractPageMarkedText(bytes: Buffer, filename: string): Promise<string> {
  let text = await callTranscription(bytes, filename);

  if (looksLikeRefusal(text, bytes.length)) {
    log.warn("Transcription looked like a refusal or truncation — retrying once", {
      filename,
      preview: text.slice(0, 200),
    });
    text = await callTranscription(bytes, filename);
  }

  if (looksLikeRefusal(text, bytes.length)) {
    log.error("Transcription still looked like a refusal after retry", {
      filename,
      preview: text.slice(0, 200),
    });
    throw new Error(
      `Couldn't transcribe "${filename}" — the model declined or returned an implausibly short result twice in a row. Try again, or try a different file.`
    );
  }

  if (!/---\s*Page\s+1\s*---/i.test(text)) {
    log.warn("Transcription missing expected page-1 marker", { filename });
  }
  return text;
}
