/**
 * Minimal structured logger — no dependency, just consistent JSON lines on
 * stdout/stderr, which is what most hosting platforms (Vercel included)
 * capture and index as-is. Swap for a real logging library if/when this
 * needs shipping to an external log sink.
 */
type LogFields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, fields?: LogFields) {
  const line = { level, message, time: new Date().toISOString(), ...fields };
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(JSON.stringify(line));
}

export const log = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
