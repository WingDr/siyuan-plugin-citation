import { strToU8, unzipSync, zipSync } from "fflate";
import { parseWordXml, WORD_NS, wordChild } from "../word/xml";

/** Native text marks contain literal text, including affiliation stars and hashes. */
export function prepareWordMarkdown(markdown: string): string {
  return markdown.replace(/<(span|sup|sub|u)\b([^>]*)>([^<]*)<\/\1>/gi, (_match, tag, attributes, text: string) => {
    const escaped = text.split(/(\[@siyuan_cite\{[^}]*\}@siyuan_name\{[^}]*\}\}\])/g).map(part =>
      part.startsWith("[@siyuan_cite{") ? part : part.replace(/[\\`*_[\]$~^]/g, character => `&#${character.charCodeAt(0)};`)
    ).join("");
    return `<${tag}${attributes}>${escaped}</${tag}>`;
  });
}

/** Pandoc emits custom character styles; assign their actual Word RGB values. */
export function applyWordColors(data: Uint8Array): Uint8Array {
  const files = unzipSync(data);
  if (!files["word/styles.xml"]) return data;
  const document = parseWordXml(files["word/styles.xml"], "word/styles.xml");
  let changed = false;
  for (const style of Array.from(document.getElementsByTagNameNS(WORD_NS, "style"))) {
    const name = wordChild(style, "name")?.getAttributeNS(WORD_NS, "val") || "";
    const color = name.match(/^SiyuanExportColor_([A-F0-9]{6})$/)?.[1];
    if (!color) continue;
    let properties = wordChild(style, "rPr");
    if (!properties) {
      properties = document.createElementNS(WORD_NS, "w:rPr");
      style.appendChild(properties);
    }
    let value = wordChild(properties, "color");
    if (!value) {
      value = document.createElementNS(WORD_NS, "w:color");
      properties.appendChild(value);
    }
    value.setAttributeNS(WORD_NS, "w:val", color);
    changed = true;
  }
  if (!changed) return data;
  files["word/styles.xml"] = strToU8(new XMLSerializer().serializeToString(document));
  return zipSync(files);
}
