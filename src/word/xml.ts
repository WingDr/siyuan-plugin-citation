import { strFromU8 } from "fflate";

export const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseWordXml(source: Uint8Array | string, path: string): Document {
  const document = new DOMParser().parseFromString(typeof source === "string" ? source : strFromU8(source), "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error(`Invalid XML: ${path}`);
  return document;
}

/** Read a direct child, without accidentally selecting a nested style's property. */
export function wordChild(parent: Element | undefined, name: string): Element | undefined {
  if (!parent) return undefined;
  for (const node of Array.from(parent.childNodes)) {
    if (node?.nodeType !== 1) continue;
    const element = node as Element;
    if (element.namespaceURI === WORD_NS && element.localName === name) return element;
  }
  return undefined;
}
