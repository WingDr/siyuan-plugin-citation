import { strToU8 } from "fflate";
import { parseWordXml, WORD_NS, wordChild as child } from "../word/xml";

/** Pandoc drops run colors, but docx+styles preserves named character styles. */
export class WordColorPreserver {
  private document: Document;
  private styles = new Map<string, Element>();
  private cache = new Map<string, string | null | undefined>();
  private generated = new Map<string, string>();
  private defaultParagraph = "";
  private defaultColor: string | null | undefined;

  constructor(private files: Record<string, Uint8Array>) {
    this.document = parseWordXml(files["word/styles.xml"] ?? `<w:styles xmlns:w="${WORD_NS}"/>`, "word/styles.xml");
    for (const style of Array.from(this.document.getElementsByTagNameNS(WORD_NS, "style"))) {
      this.styles.set(style.getAttributeNS(WORD_NS, "styleId") || "", style);
      if (style.getAttributeNS(WORD_NS, "type") === "paragraph" && /^(1|true|on)$/.test(style.getAttributeNS(WORD_NS, "default") || "")) {
        this.defaultParagraph = style.getAttributeNS(WORD_NS, "styleId") || "";
      }
    }
    this.defaultColor = this.color(child(child(this.document.documentElement, "docDefaults"), "rPrDefault"));
  }

  private color(parent: Element | undefined): string | null | undefined {
    const color = child(child(parent, "rPr"), "color");
    if (!color) return undefined;
    const value = color.getAttributeNS(WORD_NS, "val") || "";
    // "auto" explicitly returns to the editor's default text color.
    return /^[\da-f]{6}$/i.test(value) ? value.toUpperCase() : null;
  }

  private styleColor(id: string, visited = new Set<string>()): string | null | undefined {
    if (this.cache.has(id)) return this.cache.get(id);
    if (visited.has(id)) return undefined;
    visited.add(id);
    const style = this.styles.get(id);
    const own = this.color(style);
    const base = child(style, "basedOn")?.getAttributeNS(WORD_NS, "val");
    const resolved = own !== undefined ? own : base ? this.styleColor(base, visited) : undefined;
    this.cache.set(id, resolved);
    return resolved;
  }

  public preserve(document: Document, citationMarkers: Set<string>) {
    for (const run of Array.from(document.getElementsByTagNameNS(WORD_NS, "r"))) {
      const text = Array.from(run.getElementsByTagNameNS(WORD_NS, "t"));
      // References are inserted after conversion; wrapping their tokens in a
      // text mark would make the resulting block reference display literally.
      if (!text.length || text.some(node => citationMarkers.has(node.textContent || ""))) continue;
      let paragraph: Element | undefined = run;
      while (paragraph && !(paragraph.namespaceURI === WORD_NS && paragraph.localName === "p")) {
        paragraph = paragraph.parentNode?.nodeType === 1 ? paragraph.parentNode as Element : undefined;
      }
      const paragraphStyle = child(child(paragraph, "pPr"), "pStyle")?.getAttributeNS(WORD_NS, "val") || this.defaultParagraph;
      let color = this.styleColor(paragraphStyle);
      if (color === undefined) color = this.defaultColor;
      let properties = child(run, "rPr");
      let runStyle = child(properties, "rStyle");
      const baseStyle = runStyle?.getAttributeNS(WORD_NS, "val") || "";
      const characterColor = this.styleColor(baseStyle);
      if (characterColor !== undefined) color = characterColor;
      const directColor = this.color(run);
      if (directColor !== undefined) color = directColor;
      if (!color) continue;

      const key = `${color}:${baseStyle}`;
      let id = this.generated.get(key);
      if (!id) {
        let index = this.generated.size;
        do { id = `SiyuanCitationColor_${color}_${index++}`; } while (this.styles.has(id));
        const style = this.document.createElementNS(WORD_NS, "w:style");
        style.setAttributeNS(WORD_NS, "w:type", "character");
        style.setAttributeNS(WORD_NS, "w:styleId", id);
        const name = this.document.createElementNS(WORD_NS, "w:name");
        name.setAttributeNS(WORD_NS, "w:val", id);
        style.appendChild(name);
        if (baseStyle) {
          const base = this.document.createElementNS(WORD_NS, "w:basedOn");
          base.setAttributeNS(WORD_NS, "w:val", baseStyle);
          style.appendChild(base);
        }
        this.document.documentElement.appendChild(style);
        this.styles.set(id, style);
        this.generated.set(key, id);
      }
      if (!properties) {
        properties = document.createElementNS(WORD_NS, "w:rPr");
        run.insertBefore(properties, run.firstChild);
      }
      if (!runStyle) {
        runStyle = document.createElementNS(WORD_NS, "w:rStyle");
        properties.insertBefore(runStyle, properties.firstChild);
      }
      runStyle.setAttributeNS(WORD_NS, "w:val", id);
    }
  }

  public save() {
    if (this.generated.size) this.files["word/styles.xml"] = strToU8(new XMLSerializer().serializeToString(this.document));
  }
}
