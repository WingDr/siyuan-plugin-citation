import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export interface ZoteroCitationItem {
  id?: string | number;
  uris?: string[];
  uri?: string[];
  itemData?: Record<string, any>;
  prefix?: string;
  suffix?: string;
  locator?: string;
  label?: string;
}

export interface WordCitation {
  marker: string;
  text: string;
  items: ZoteroCitationItem[];
}

function createCitationMarkerRun(doc: Document, marker: string): Element {
  const run = doc.createElementNS(WORD_NS, "w:r");
  const properties = doc.createElementNS(WORD_NS, "w:rPr");
  const alignment = doc.createElementNS(WORD_NS, "w:vertAlign");
  // Override both direct and inherited Word citation-number formatting.
  alignment.setAttributeNS(WORD_NS, "w:val", "baseline");
  properties.appendChild(alignment);
  run.appendChild(properties);
  const value = doc.createElementNS(WORD_NS, "w:t");
  value.textContent = marker;
  run.appendChild(value);
  return run;
}

function insertCitationMarker(doc: Document, start: Element, marker: string): void {
  const run = start.parentNode as Element;
  const markerRun = createCitationMarkerRun(doc, marker);
  // Field boundaries are run children in WordprocessingML. Split at the boundary
  // so resetting the citation's baseline cannot restyle adjacent text in that run.
  const tail = run.cloneNode(false) as Element;
  const properties = Array.from(run.childNodes).find(node =>
    node?.nodeType === 1 && (node as Element).namespaceURI === WORD_NS && (node as Element).localName === "rPr");
  if (properties) tail.appendChild(properties.cloneNode(true));
  for (let node: ChildNode | null = start; node;) {
    const next: ChildNode | null = node.nextSibling;
    tail.appendChild(node);
    node = next;
  }
  const parent = run.parentNode!;
  const nextRun = run.nextSibling;
  parent.insertBefore(markerRun, nextRun);
  parent.insertBefore(tail, nextRun);
}

/** Replace fields before Pandoc reads them: its DOCX reader discards field instructions. */
export function prepareZoteroWord(data: Uint8Array, token: string) {
  const files = unzipSync(data);
  if (!files["word/document.xml"]) throw new Error("Invalid DOCX: word/document.xml");
  const citations: WordCitation[] = [];
  let malformed = 0;
  let removedBibliographies = 0;
  const isBibliography = (instruction: string) => /^\s*ADDIN\s+ZOTERO_BIBL\b/.test(instruction);
  for (const path of Object.keys(files)) {
    // Footnotes/endnotes can contain citations too; do not import deleted revisions.
    if (!/^word\/(document|footnotes|endnotes)\.xml$/.test(path)) continue;
    const doc = new DOMParser().parseFromString(strFromU8(files[path]), "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error(`Invalid XML: ${path}`);

    const register = (instruction: string, text: string): string | undefined => {
      if (!/^\s*ADDIN\s+ZOTERO_ITEM\s+CSL_CITATION\s*/.test(instruction)) return;
      try {
        const start = instruction.indexOf("{");
        const end = instruction.lastIndexOf("}");
        const payload = JSON.parse(instruction.slice(start, end + 1));
        if (!Array.isArray(payload.citationItems) || !payload.citationItems.length ||
            payload.citationItems.some((item: unknown) => !item || typeof item !== "object")) {
          throw new Error("Invalid citationItems");
        }
        const marker = `SIYUANCITATION${token}N${citations.length}END`;
        citations.push({ marker, text: text || payload.properties?.plainCitation || "", items: payload.citationItems });
        return marker;
      } catch {
        malformed++;
      }
    };

    interface Field { start: Element; nodes: Element[]; instruction: string; text: string; result: boolean }
    const stack: Field[] = [];
    const visit = (element: Element) => {
      const word = element.namespaceURI === WORD_NS;
      const name = element.localName;
      if (word && (name === "del" || name === "moveFrom")) return;
      if (word && name === "fldSimple") {
        const instruction = element.getAttributeNS(WORD_NS, "instr") || "";
        if (isBibliography(instruction)) {
          element.parentNode!.removeChild(element);
          removedBibliographies++;
          return;
        }
        const text = Array.from(element.getElementsByTagNameNS(WORD_NS, "t")).map(el => el.textContent).join("");
        const marker = register(instruction, text);
        if (marker) {
          element.parentNode!.replaceChild(createCitationMarkerRun(doc, marker), element);
          return;
        }
      }
      if (word && name === "fldChar") {
        const type = element.getAttributeNS(WORD_NS, "fldCharType");
        if (type === "begin") stack.push({ start: element, nodes: [], instruction: "", text: "", result: false });
        for (const field of stack) field.nodes.push(element);
        const field = stack[stack.length - 1];
        if (field && type === "separate") field.result = true;
        if (field && type === "end") {
          stack.pop();
          if (isBibliography(field.instruction)) {
            for (const node of field.nodes) node.parentNode?.removeChild(node);
            removedBibliographies++;
            return;
          }
          const marker = register(field.instruction, field.text);
          if (marker) {
            insertCitationMarker(doc, field.start, marker);
            for (const node of field.nodes) node.parentNode?.removeChild(node);
          }
        }
        return;
      }
      if (word && ["instrText", "t", "tab", "br", "cr"].includes(name)) {
        for (const field of stack) {
          field.nodes.push(element);
          if (name === "instrText" && !field.result) field.instruction += element.textContent || "";
          if (field.result && name === "t") field.text += element.textContent || "";
          if (field.result && name === "tab") field.text += "\t";
          if (field.result && (name === "br" || name === "cr")) field.text += "\n";
        }
        return;
      }
      // Snapshot the children, because field replacement mutates this tree.
      for (const child of Array.from(element.childNodes)) {
        if (child?.nodeType === 1) visit(child as Element);
      }
    };
    visit(doc.documentElement);
    malformed += stack.filter(field => /ZOTERO_ITEM/.test(field.instruction)).length;
    files[path] = strToU8(new XMLSerializer().serializeToString(doc));
  }
  return { data: zipSync(files), citations, malformed, removedBibliographies };
}

export interface ImportEntry {
  key: string;
  itemKey?: string;
  citekey?: string;
  DOI?: string;
  title?: string;
  shortAuthor?: string;
  year?: string;
  entry?: { data?: { itemID?: number; id?: number; libraryID?: number } };
  [key: string]: any;
}

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
