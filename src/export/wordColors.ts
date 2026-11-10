import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

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
  const document = new DOMParser().parseFromString(strFromU8(files["word/styles.xml"]), "application/xml");
  let changed = false;
  for (const style of Array.from(document.getElementsByTagNameNS(WORD_NS, "style"))) {
    const name = style.getElementsByTagNameNS(WORD_NS, "name")[0]?.getAttributeNS(WORD_NS, "val") || "";
    const color = name.match(/^SiyuanExportColor_([A-F0-9]{6})$/)?.[1];
    if (!color) continue;
    let properties = style.getElementsByTagNameNS(WORD_NS, "rPr")[0];
    if (!properties) {
      properties = document.createElementNS(WORD_NS, "w:rPr");
      style.appendChild(properties);
    }
    let value = properties.getElementsByTagNameNS(WORD_NS, "color")[0];
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
