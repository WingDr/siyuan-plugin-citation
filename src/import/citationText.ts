import type { ImportEntry, ZoteroCitationItem } from "./types";

export function staticReference(id: string, text: string): string {
  // Lute keeps backslash escapes in reference anchors; HTML entities display correctly.
  const anchor = text.replace(/[\r\n\t]+/g, " ").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\\/g, "&#92;");
  return `((${id} "${anchor}"))`;
}

export function markdownText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/[\\`*_[\]<>]/g, "\\$&");
}

export function citationItemText(item: ZoteroCitationItem, entry: ImportEntry, label =
  [entry.shortAuthor, entry.year].filter(Boolean).join(" ") || entry.title || entry.citekey || entry.itemKey || entry.key): string {
  const locator = item.locator ? `, ${item.label || "page"} ${item.locator}` : "";
  return `${item.prefix || ""}${label}${locator}${item.suffix || ""}`;
}
