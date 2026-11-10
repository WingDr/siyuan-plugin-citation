import type { ImportEntry, ZoteroCitationItem } from "./types";

function doi(value: unknown): string {
  return String(value || "").trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
}

/** Ambiguous identities stay unresolved. Numeric Zotero IDs are only a legacy fallback. */
export class CitationMatcher {
  private index = new Map<string, ImportEntry | null>();

  constructor(entries: ImportEntry[]) {
    for (const entry of entries) {
      const libraryID = entry.entry?.data?.libraryID;
      // LiteratureNote currently stores personal-library keys with the 1_ prefix.
      if (libraryID != null && libraryID !== 1) continue;
      const identities = [
        entry.itemKey && `item:${entry.itemKey}`,
        entry.citekey && `cite:${entry.citekey}`,
        entry.DOI && `doi:${doi(entry.DOI)}`,
        libraryID === 1 && typeof entry.entry?.data?.itemID === "number" && `id:${entry.entry.data.itemID}`,
      ].filter(Boolean) as string[];
      for (const identity of identities) {
        const previous = this.index.get(identity);
        this.index.set(identity, previous === undefined || previous?.key === entry.key ? entry : null);
      }
    }
  }

  match(item: ZoteroCitationItem): ImportEntry | undefined {
    const uris = [...(item.uris || []), ...(item.uri || [])];
    // Do not confuse a group's item with an equally named personal-library item.
    if (uris.some(uri => /\/groups\//.test(uri))) return;
    const itemKeys = uris.map(uri => uri.match(/\/items\/([A-Z0-9]{8})(?:[/?#]|$)/i)?.[1]).filter(Boolean);
    const citekey = item.itemData?.["citation-key"] || item.itemData?.citationKey;
    const identities = [
      ...itemKeys.map(key => `item:${key}`),
      item.itemData?.DOI && `doi:${doi(item.itemData.DOI)}`,
      citekey && `cite:${citekey}`,
    ].filter(Boolean) as string[];
    // Exported but not yet Zotero-refreshed files from this plugin only contain id.
    if (!identities.length && !uris.length && !item.itemData && item.id != null) identities.push(`id:${item.id}`);
    for (const identity of identities) {
      const found = this.index.get(identity);
      if (found === null) return;
      if (found) return found;
    }
  }
}

