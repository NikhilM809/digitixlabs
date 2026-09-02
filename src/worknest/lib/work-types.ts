export function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

export function splitEstimatedHours(total: number) {
  const safe = Math.max(0, total || 0);
  const programmer = roundHours(safe * 0.6);
  const qa = roundHours(safe * 0.3);
  const margin = roundHours(Math.max(0, safe - programmer - qa));
  return { programmer, qa, margin };
}

export function slugWorkTypeCode(name: string) {
  const code = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return code || "WORK";
}

export function workTypeBucket(code: string) {
  const value = code.toUpperCase();
  if (value === "CHANGES" || value === "CHANGES_QA" || value.startsWith("CHANGES")) return "changes";
  if (value === "INITIAL_SCRIPTING" || value === "INITIAL_QA" || value.startsWith("INITIAL")) return "initial";
  if (value === "LIVE" || value === "PROJECT_MANAGEMENT" || value.includes("LIVE") || value.includes("MANAGEMENT")) {
    return "live";
  }
  return "other";
}
