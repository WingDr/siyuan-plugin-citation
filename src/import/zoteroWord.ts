import { strToU8, unzipSync, zipSync } from "fflate";
import { WordColorPreserver } from "./wordColors";
import { parseWordXml, WORD_NS, wordChild } from "../word/xml";
import type { WordCitation, ZoteroCitationItem } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCitationItem(value: unknown): value is ZoteroCitationItem {
  if (!isRecord(value)) return false;
  if (value.id !== undefined && typeof value.id !== "string" && typeof value.id !== "number") return false;
  for (const key of ["uris", "uri"]) {
    const uris = value[key];
    if (uris !== undefined && (!Array.isArray(uris) || !uris.every(uri => typeof uri === "string"))) return false;
  }
  for (const key of ["prefix", "suffix", "locator", "label"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return false;
  }
  if (value.itemData !== undefined) {
    if (!isRecord(value.itemData)) return false;
    for (const key of ["DOI", "citationKey", "citation-key"]) {
      if (value.itemData[key] !== undefined && typeof value.itemData[key] !== "string") return false;
    }
  }
  return true;
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
  const properties = wordChild(run, "rPr");
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
  const colors = new WordColorPreserver(files);
  const citations: WordCitation[] = [];
  let malformed = 0;
  for (const path of Object.keys(files)) {
    // Footnotes/endnotes can contain citations too; do not import deleted revisions.
    if (!/^word\/(document|footnotes|endnotes)\.xml$/.test(path)) continue;
    const doc = parseWordXml(files[path], path);

    const register = (instruction: string, text: string): string | undefined => {
      if (!/^\s*ADDIN\s+ZOTERO_ITEM\s+CSL_CITATION\s*/.test(instruction)) return;
      try {
        const start = instruction.indexOf("{");
        const end = instruction.lastIndexOf("}");
        const payload: unknown = JSON.parse(instruction.slice(start, end + 1));
        if (!isRecord(payload) || !Array.isArray(payload.citationItems) || !payload.citationItems.length ||
            !payload.citationItems.every(isCitationItem)) {
          throw new Error("Invalid citationItems");
        }
        const marker = `SIYUANCITATION${token}N${citations.length}END`;
        const plainCitation = isRecord(payload.properties) && typeof payload.properties.plainCitation === "string"
          ? payload.properties.plainCitation : "";
        citations.push({ marker, text: text || plainCitation, items: payload.citationItems });
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
    colors.preserve(doc, new Set(citations.map(citation => citation.marker)));
    files[path] = strToU8(new XMLSerializer().serializeToString(doc));
  }
  colors.save();
  return { data: zipSync(files), citations, malformed };
}
