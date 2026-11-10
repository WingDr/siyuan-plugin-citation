import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { CitationMatcher, citationItemText, markdownText, prepareZoteroWord, staticReference } from "../src/import/zoteroWord";
import { LiteraturePool, getLiteratureKey } from "../src/references/pool";
import { formatMultiCitation, renderCiteLink } from "../src/references/citationFormat";
import { applyWordColors, prepareWordMarkdown } from "../src/export/wordColors";

Object.assign(globalThis, { DOMParser, XMLSerializer });
const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push([name, run]);
const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const xml = (body: string) => `<w:document xmlns:w="${ns}"><w:body><w:p>${body}</w:p></w:body></w:document>`;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const text = (value: string) => `<w:r><w:t>${escape(value)}</w:t></w:r>`;
const instruction = (items: any[]) => ` ADDIN ZOTERO_ITEM CSL_CITATION ${JSON.stringify({citationItems: items})} `;
const item = (key = "ABCDEFGH") => ({ id: 999, uris: [`http://zotero.org/users/local/abc/items/${key}`] });
const complex = (items: any[], label = "[1]", split = false) => {
  const code = instruction(items);
  const codes = split ? [code.slice(0, 35), code.slice(35)] : [code];
  return `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
    codes.map(part => `<w:r><w:instrText xml:space="preserve">${escape(part)}</w:instrText></w:r>`).join("") +
    `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${text(label)}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
};
const archive = (body: string, extra = {}) => zipSync({"word/document.xml": strToU8(xml(body)), ...extra});
const outputXML = (data: Uint8Array) => strFromU8(unzipSync(data)["word/document.xml"]);

test("split complex field becomes a stable marker without losing adjacent text", () => {
  const result = prepareZoteroWord(archive(text("Before ") + complex([item()], "[1]", true) + text(" after")), "TEST");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].text, "[1]");
  assert.deepEqual(result.citations[0].items, [item()]);
  const out = outputXML(result.data);
  assert.match(out, /Before /);
  assert.match(out, / after/);
  assert.match(out, /SIYUANCITATIONTESTN0END/);
  assert.doesNotMatch(out, /ZOTERO_ITEM|fldChar|instrText|\[1\]/);
});

test("simple fields, multiple citations, tables and footnotes are recognized", () => {
  const simple = `<w:fldSimple w:instr="${escape(instruction([item(), item("IJKLMNOP")]))}">${text("[1,2]")}</w:fldSimple>`;
  const notes = `<w:footnotes xmlns:w="${ns}"><w:footnote w:id="1"><w:p>${complex([item()], "note")}</w:p></w:footnote></w:footnotes>`;
  const result = prepareZoteroWord(archive(simple + `<w:tbl><w:tr><w:tc><w:p>${complex([item()])}</w:p></w:tc></w:tr></w:tbl>`, {
    "word/footnotes.xml": strToU8(notes), "word/endnotes.xml": strToU8(notes), "word/media/image.png": new Uint8Array([1, 2, 3]),
  }), "T");
  assert.equal(result.citations.length, 4);
  assert.equal(result.citations[0].items.length, 2);
  assert.equal(new Set(result.citations.map(c => c.marker)).size, 4);
  assert.deepEqual(unzipSync(result.data)["word/media/image.png"], new Uint8Array([1, 2, 3]));
});

test("Zotero bibliography fields are omitted without removing surrounding text or other fields", () => {
  const body = text("Before bibliography ") + complex([item()], "Bibliography entry").replace("ZOTERO_ITEM CSL_CITATION", "ZOTERO_BIBL") +
    text(" after bibliography") +
    `<w:fldSimple w:instr=" ADDIN ZOTERO_BIBL {} CSL_BIBLIOGRAPHY">${text("Simple bibliography entry")}</w:fldSimple>` +
    `<w:fldSimple w:instr="PAGE">${text("4")}</w:fldSimple>`;
  const result = prepareZoteroWord(archive(body), "T");
  assert.equal(result.citations.length, 0);
  assert.equal(result.removedBibliographies, 2);
  assert.doesNotMatch(outputXML(result.data), /ZOTERO_BIBL|Bibliography entry|Simple bibliography entry/);
  assert.match(outputXML(result.data), /Before bibliography /);
  assert.match(outputXML(result.data), / after bibliography/);
  assert.match(outputXML(result.data), /PAGE/);
});

test("multi-paragraph bibliography is omitted while ordinary reference text is retained", () => {
  const bibliography = complex([item()], "BIBLIOGRAPHYENTRIES")
    .replace("ZOTERO_ITEM CSL_CITATION", "ZOTERO_BIBL")
    .replace("BIBLIOGRAPHYENTRIES", "Entry one</w:t></w:r></w:p><w:p><w:r><w:t>Entry two");
  const result = prepareZoteroWord(archive(text("Plain bibliography text") + bibliography + text("After list")), "T");
  assert.equal(result.removedBibliographies, 1);
  assert.doesNotMatch(outputXML(result.data), /Entry one|Entry two/);
  assert.match(outputXML(result.data), /Plain bibliography text/);
  assert.match(outputXML(result.data), /After list/);
});

test("templates own all brackets and separators inside the individual reference anchors", () => {
  const first = {shortAuthor: "Lanz and Kathman et al.", containerTitle: "Nature", year: "2026"};
  const second = {shortAuthor: "Nair and Karigo et al.", containerTitle: "Cell", year: "2023"};
  const settings = {linkTemplate: "({{shortAuthor}}, {{containerTitle}}, {{year}})", multiCitePrefix: "", multiCiteConnector: "", multiCiteSuffix: ""};
  const labels = [first, second].map((entry, i) => formatMultiCitation(renderCiteLink(settings.linkTemplate, entry, "id", i), i, 2, settings));
  assert.deepEqual(labels, ["(Lanz and Kathman et al., Nature, 2026)", "(Nair and Karigo et al., Cell, 2023)"]);
  const refs = labels.map((label, i) => staticReference(`20261110000000-${i ? "bbbbbbb" : "aaaaaaa"}`, label)).join("");
  assert.equal(refs, '((20261110000000-aaaaaaa "(Lanz and Kathman et al., Nature, 2026)"))((20261110000000-bbbbbbb "(Nair and Karigo et al., Cell, 2023)"))');
  const grouped = {multiCitePrefix: "(", multiCiteConnector: "; ", multiCiteSuffix: ")"};
  assert.equal(formatMultiCitation("A", 0, 2, grouped), "(A; ");
  assert.equal(formatMultiCitation("B", 1, 2, grouped), "B)");
  assert.equal(formatMultiCitation("A", 0, 1, grouped), "(A)");
});

test("malformed and unterminated fields preserve visible text and report failures", () => {
  const broken = complex([item()], "original").replace("citationItems", "badItems");
  const unclosed = complex([item()], "unfinished").replace(/<w:r><w:fldChar w:fldCharType="end"\/><\/w:r>$/, "");
  const result = prepareZoteroWord(archive(broken + unclosed), "T");
  assert.equal(result.malformed, 2);
  assert.equal(result.citations.length, 0);
  assert.match(outputXML(result.data), /original/);
  assert.match(outputXML(result.data), /unfinished/);
});

test("deleted citations do not count as active citations", () => {
  const result = prepareZoteroWord(archive(`<w:del>${complex([item()])}</w:del>` + complex([item()], "active")), "T");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].text, "active");
});

test("empty, invalid and ordinary DOCX input is handled", () => {
  assert.throws(() => prepareZoteroWord(new Uint8Array([1, 2]), "T"));
  assert.throws(() => prepareZoteroWord(zipSync({}), "T"), /Invalid DOCX/);
  assert.equal(prepareZoteroWord(archive(text("ordinary text")), "T").citations.length, 0);
});

test("citation markers use the baseline while adjacent superscripts and subscripts retain their formatting", () => {
  const dir = mkdtempSync(join(tmpdir(), "citation-alignment-test-"));
  try {
    writeFileSync(join(dir, "source.md"), "Ordinary x^2^ and H~2~O. CITATION\n");
    execFileSync("pandoc", ["source.md", "-o", "source.docx"], {cwd: dir});
    const original = unzipSync(readFileSync(join(dir, "source.docx")));
    for (const alignment of ["superscript", "subscript", "inherited-superscript"]) {
      const files = {...original};
      const inherited = alignment === "inherited-superscript";
      const properties = inherited ? '<w:rStyle w:val="CitationNumber"/>' : `<w:vertAlign w:val="${alignment}"/>`;
      // Deliberately put text on both sides of the field in the same styled run.
      const run = `<w:r><w:rPr>${properties}</w:rPr><w:t>L</w:t><w:fldChar w:fldCharType="begin"/>` +
        `<w:instrText>${escape(instruction([item()]))}</w:instrText><w:fldChar w:fldCharType="separate"/>` +
        '<w:t>1</w:t><w:fldChar w:fldCharType="end"/><w:t>R</w:t></w:r>';
      files["word/document.xml"] = strToU8(strFromU8(files["word/document.xml"])
        .replace("CITATION", `</w:t></w:r>${run}<w:r><w:t>`));
      if (inherited) files["word/styles.xml"] = strToU8(strFromU8(files["word/styles.xml"])
        .replace("</w:styles>", '<w:style w:type="character" w:styleId="CitationNumber"><w:name w:val="CitationNumber"/>' +
          '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style></w:styles>'));
      const prepared = prepareZoteroWord(zipSync(files), "ALIGNMENT");
      writeFileSync(join(dir, "prepared.docx"), prepared.data);
      const markdown = execFileSync("pandoc", ["prepared.docx", "--to=markdown", "--wrap=none"], {cwd: dir, encoding: "utf8"});
      assert.equal(prepared.citations.length, 1);
      const delimiter = alignment === "subscript" ? "~" : "^";
      assert.ok(markdown.includes(`${delimiter}L${delimiter}${prepared.citations[0].marker}${delimiter}R${delimiter}`), markdown);
      assert.ok(markdown.includes("x^2^"), markdown);
      assert.ok(markdown.includes("H~2~O"), markdown);
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test("Word author affiliations and chemical subscripts use native SiYuan marks without optional syntax", () => {
  const dir = mkdtempSync(join(tmpdir(), "citation-native-script-test-"));
  try {
    writeFileSync(join(dir, "source.md"), "Author^1,2#^, Author^6\\*^\n\n^1^Institute\n\n^\\#^Equal contribution. H~2~O, x^2^, ^**bold**^ and `literal ^caret^ ~tilde~`.\n");
    execFileSync("pandoc", ["source.md", "-o", "source.docx"], {cwd: dir});
    const markdown = execFileSync("pandoc", ["source.docx", "--to=markdown", "--wrap=none",
      "--lua-filter", join(__dirname, "../scripts/import-word.lua")], {cwd: dir, encoding: "utf8"});
    assert.ok(markdown.includes('Author<span data-type="sup">1,2#</span>'), markdown);
    assert.ok(markdown.includes('Author<span data-type="sup">6*</span>'), markdown);
    assert.ok(markdown.includes('<span data-type="sup">1</span>Institute'), markdown);
    assert.ok(markdown.includes('<span data-type="sup">#</span>Equal contribution'), markdown);
    assert.ok(markdown.includes('H<span data-type="sub">2</span>O'), markdown);
    assert.ok(markdown.includes('x<span data-type="sup">2</span>'), markdown);
    assert.ok(markdown.includes('**<span data-type="sup">bold</span>**'), markdown);
    assert.ok(markdown.includes('`literal ^caret^ ~tilde~`'), markdown);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test("Word RGB, inherited colors, scripts and hyperlinks survive import and DOCX re-export", () => {
  const dir = mkdtempSync(join(tmpdir(), "citation-color-roundtrip-"));
  try {
    writeFileSync(join(dir, "source.md"), "# HEADING\n\nDIRECT\n\nCHAR\n\nPARAGRAPH\n\nAUTO\n\nSUP\n\nSUB\n\nBOLD\n\nESCAPED\n\n[LINK](https://example.com/?x=1&y=2)\n\nCITATION\n");
    execFileSync("pandoc", ["source.md", "-o", "source.docx"], {cwd: dir});
    const files = unzipSync(readFileSync(join(dir, "source.docx")));
    const doc = new DOMParser().parseFromString(strFromU8(files["word/document.xml"]), "application/xml");
    const styles = new DOMParser().parseFromString(strFromU8(files["word/styles.xml"]), "application/xml");
    const targets = new Map(Array.from(doc.getElementsByTagNameNS(ns, "t")).map(node => [node.textContent, node]));
    const property = (parent: any, name: string, value: string) => {
      const node = doc.createElementNS(ns, `w:${name}`);
      node.setAttributeNS(ns, "w:val", value);
      parent.appendChild(node);
    };
    const runProperty = (text: string, name: string, value: string) => {
      const run = targets.get(text)!.parentNode! as any;
      let props = run.getElementsByTagNameNS(ns, "rPr")[0];
      if (!props) {props = doc.createElementNS(ns, "w:rPr"); run.insertBefore(props, run.firstChild);}
      property(props, name, value);
    };
    const paragraphStyle = (text: string) => {
      let paragraph = targets.get(text)!.parentNode! as any;
      while (paragraph.localName !== "p") paragraph = paragraph.parentNode;
      const props = paragraph.getElementsByTagNameNS(ns, "pPr")[0];
      const current = props.getElementsByTagNameNS(ns, "pStyle")[0];
      if (current) current.setAttributeNS(ns, "w:val", "ColoredParagraph");
      else property(props, "pStyle", "ColoredParagraph");
    };
    const additions = new DOMParser().parseFromString(`<w:styles xmlns:w="${ns}">
      <w:style w:type="character" w:styleId="BaseRed"><w:name w:val="BaseRed"/><w:rPr><w:color w:val="EE0000"/></w:rPr></w:style>
      <w:style w:type="character" w:styleId="InheritedRed"><w:name w:val="InheritedRed"/><w:basedOn w:val="BaseRed"/></w:style>
      <w:style w:type="paragraph" w:styleId="ColoredParagraph"><w:name w:val="ColoredParagraph"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="335577"/></w:rPr></w:style>
    </w:styles>`, "application/xml");
    for (const style of Array.from(additions.getElementsByTagNameNS(ns, "style"))) styles.documentElement.appendChild(styles.importNode(style, true));
    runProperty("HEADING", "color", "EE0000");
    runProperty("DIRECT", "color", "123456");
    runProperty("CHAR", "rStyle", "InheritedRed");
    paragraphStyle("PARAGRAPH");
    paragraphStyle("AUTO"); runProperty("AUTO", "color", "auto");
    runProperty("SUP", "color", "EE0000"); runProperty("SUP", "vertAlign", "superscript");
    runProperty("SUB", "color", "334455"); runProperty("SUB", "vertAlign", "subscript");
    runProperty("BOLD", "color", "EE0000"); runProperty("BOLD", "b", "true");
    runProperty("ESCAPED", "color", "AABBCC"); targets.get("ESCAPED")!.textContent = "<red & blue>";
    runProperty("LINK", "color", "EE0000");
    paragraphStyle("CITATION");
    const sourceRun = targets.get("CITATION")!.parentNode!;
    const field = new DOMParser().parseFromString(xml(complex([item()], "1")), "application/xml");
    const fieldParagraph = field.getElementsByTagNameNS(ns, "p")[0];
    for (const run of Array.from(fieldParagraph.childNodes)) sourceRun.parentNode!.insertBefore(doc.importNode(run, true), sourceRun);
    sourceRun.parentNode!.removeChild(sourceRun);
    files["word/document.xml"] = strToU8(new XMLSerializer().serializeToString(doc));
    files["word/styles.xml"] = strToU8(new XMLSerializer().serializeToString(styles));
    const prepared = prepareZoteroWord(zipSync(files), "COLORTEST");
    writeFileSync(join(dir, "prepared.docx"), prepared.data);
    const imported = execFileSync("pandoc", ["prepared.docx", "--from=docx+styles", "--to=markdown-grid_tables-simple_tables-multiline_tables-link_attributes-header_attributes-fenced_divs-bracketed_spans-native_divs-native_spans", "--wrap=none",
      "--lua-filter", join(__dirname, "../scripts/import-word.lua")], {cwd: dir, encoding: "utf8"});
    assert.ok(imported.includes('<span data-type="text" style="color: #123456;">DIRECT</span>'), imported);
    assert.ok(imported.includes('<span data-type="text" style="color: #EE0000;">CHAR</span>'), imported);
    assert.ok(imported.includes('<span data-type="text" style="color: #335577;">PARAGRAPH</span>'), imported);
    assert.ok(imported.includes('<span data-type="sup text" style="color: #EE0000;">SUP</span>'), imported);
    assert.ok(imported.includes('<span data-type="sub text" style="color: #334455;">SUB</span>'), imported);
    assert.ok(imported.includes('&lt;red &amp; blue&gt;'), imported);
    assert.doesNotMatch(imported, /SiyuanCitationColor_|data-custom-style|>AUTO<|>SIYUANCITATION/);
    writeFileSync(join(dir, "export.md"), prepareWordMarkdown(imported.replace(prepared.citations[0].marker, '[@siyuan_cite{42}@siyuan_name{refresh}}]') +
      '\n\n<span style="color: #445566">[@siyuan_cite{84}@siyuan_name{coloredCitation}}]</span>\n\n' +
      '<span style="color: rgb(17, 34, 51)">RGB</span> <span style="color: #0f0">SHORTHEX</span> <span style="color: red">NAMED</span>\n' +
      '<span data-type="sup text" style="color:#EE0000">6*</span> &amp; normal <span data-type="sup">7*</span>\n'));
    execFileSync("pandoc", ["export.md", "-o", "export.docx", "--lua-filter", join(__dirname, "../scripts/citation.lua"),
      "--lua-filter", join(__dirname, "../scripts/export-word.lua")], {cwd: dir});
    const result = unzipSync(applyWordColors(readFileSync(join(dir, "export.docx"))));
    const exportedStyles = new DOMParser().parseFromString(strFromU8(result["word/styles.xml"]), "application/xml");
    const styleColors = new Map(Array.from(exportedStyles.getElementsByTagNameNS(ns, "style")).map(style => [
      style.getAttributeNS(ns, "styleId"), style.getElementsByTagNameNS(ns, "color")[0]?.getAttributeNS(ns, "val"),
    ]));
    const exportedDoc = new DOMParser().parseFromString(strFromU8(result["word/document.xml"]), "application/xml");
    const runs = Array.from(exportedDoc.getElementsByTagNameNS(ns, "r")).map(run => ({
      text: Array.from(run.getElementsByTagNameNS(ns, "t")).map(node => node.textContent).join(""),
      color: run.getElementsByTagNameNS(ns, "color")[0]?.getAttributeNS(ns, "val") || styleColors.get(run.getElementsByTagNameNS(ns, "rStyle")[0]?.getAttributeNS(ns, "val")),
      alignment: run.getElementsByTagNameNS(ns, "vertAlign")[0]?.getAttributeNS(ns, "val"),
      bold: run.getElementsByTagNameNS(ns, "b").length > 0,
    }));
    for (const [text, color] of [["HEADING", "EE0000"], ["DIRECT", "123456"], ["CHAR", "EE0000"], ["PARAGRAPH", "335577"], ["BOLD", "EE0000"], ["LINK", "EE0000"]]) {
      assert.equal(runs.find(run => run.text === text)?.color, color, text);
    }
    assert.equal(runs.find(run => run.text === "SUP")?.alignment, "superscript");
    assert.equal(runs.find(run => run.text === "SUP")?.color, "EE0000");
    assert.equal(runs.find(run => run.text === "SUB")?.alignment, "subscript");
    assert.equal(runs.find(run => run.text === "SUB")?.color, "334455");
    assert.ok(runs.find(run => run.text === "BOLD")?.bold);
    assert.equal(runs.find(run => run.text === "coloredCitation")?.color, "445566");
    assert.equal(runs.find(run => run.text === "RGB")?.color, "112233");
    assert.equal(runs.find(run => run.text === "SHORTHEX")?.color, "00FF00");
    assert.equal(runs.find(run => run.text === "NAMED")?.color, "FF0000");
    assert.equal(runs.find(run => run.text === "6*")?.alignment, "superscript");
    assert.ok(runs.some(run => run.text.includes("& normal") && run.alignment !== "superscript"));
    assert.equal(runs.filter(run => run.color === "AABBCC").map(run => run.text).join(""), "<red & blue>");
    assert.ok(exportedDoc.getElementsByTagNameNS(ns, "hyperlink").length > 0);
    assert.match(strFromU8(result["word/document.xml"]), /ZOTERO_ITEM CSL_CITATION/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

const entries = [
  { key: "1_Smith2024", itemKey: "ABCDEFGH", citekey: "Smith2024", DOI: "10.1000/ABC", title: "Title A", entry: {data: {id: 42, itemID: 42, libraryID: 1}} },
  { key: "1_Jones2025", itemKey: "IJKLMNOP", citekey: "Jones2025", title: "Title B", entry: {data: {id: 43, itemID: 43, libraryID: 1}} },
];

test("item URIs outrank foreign numeric IDs; DOI and citekey are fallbacks", () => {
  const matcher = new CitationMatcher(entries);
  assert.equal(matcher.match({...item(), id: 43})?.key, entries[0].key);
  assert.equal(matcher.match({itemData: {DOI: "https://doi.org/10.1000/abc"}})?.key, entries[0].key);
  assert.equal(matcher.match({itemData: {"citation-key": "Jones2025"}})?.key, entries[1].key);
  assert.equal(matcher.match({id: 42})?.key, entries[0].key);
  assert.equal(matcher.match({id: 42, itemData: {title: "Different library"}}), undefined);
  assert.equal(matcher.match({...item("XXXXXXXX"), id: 42}), undefined);
});

test("ambiguous identities and group libraries are never guessed", () => {
  const matcher = new CitationMatcher([...entries, {...entries[0], key: "1_duplicate"}]);
  assert.equal(matcher.match(item()), undefined);
  assert.equal(new CitationMatcher(entries).match({uris: ["http://zotero.org/groups/12/items/ABCDEFGH"], itemData: {DOI: "10.1000/abc"}}), undefined);
});

test("static anchors escape quotes; individual citations retain prefix/suffix/locator", () => {
  assert.equal(staticReference("20261110000000-abcdefg", 'A "quoted" \\ title\nnext'), '((20261110000000-abcdefg "A &quot;quoted&quot; &#92; title next"))');
  assert.equal(markdownText("[99] *literal* <tag> &"), "\\[99\\] \\*literal\\* \\<tag\\> &amp;");
  assert.equal(citationItemText({prefix: "see ", locator: "12–14", label: "page", suffix: ", also"}, {...entries[0], shortAuthor: "Smith", year: "2024"}), "see Smith 2024, page 12–14, also");
  assert.equal(getLiteratureKey({citekey: "", itemKey: "ABCDEFGH"}, false), "1_ABCDEFGH");
  assert.equal(getLiteratureKey({citekey: "Smith2024", itemKey: "ABCDEFGH"}, false), "1_Smith2024");
});

// Use real import/export conversion; replace the host APIs and literature-note creation.
test("real Pandoc import retains images, table, footnotes, citations and repeat-import identity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "citation-import-test-"));
  const Module = require("node:module");
  const originalLoad = Module._load;
  const messages = require("../src/i18n/zh_CN.json");
  const opened: any[] = [];
  class LiteratureNote {
    async updateLiteratureNote(_key: string, _entry: any) {}
  }
  Module._load = function(name: string, ...args: any[]) {
    if (name === "siyuan") return {openTab: async (options: any) => opened.push(options), getFrontend: () => "desktop"};
    if (name === "../references/literatureNote") return {LiteratureNote};
    return originalLoad.call(this, name, ...args);
  };
  (globalThis as any).window = {crypto: webcrypto, siyuan: {config: {system: {workspaceDir: dir, dataDir: join(dir, "data")}}}};
  const { ImportManager } = require("../src/import/importManager");
  const originalUpdate = LiteratureNote.prototype.updateLiteratureNote;
  try {
    writeFileSync(join(dir, "image.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
    writeFileSync(join(dir, "source.md"), '# Heading\n\nBefore CITATIONONE after. CLUSTER UNKNOWN\n\nAuthor^1,2#^ and H~2~O.\n\n| Column | Value |\n|---|---|\n| A | B |\n\n![picture](image.png)\n\nWith note[^1].\n\nBIBLIOGRAPHY\n\n[^1]: Footnote CITATIONFOOT\n');
    execFileSync("pandoc", ["source.md", "-o", "source.docx"], {cwd: dir});
    const files = unzipSync(readFileSync(join(dir, "source.docx")));
    files["word/document.xml"] = strToU8(strFromU8(files["word/document.xml"])
      .replace("CITATIONONE", `</w:t></w:r>${complex([item()], "1", true).replace(/<w:r>/g, '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr>')}<w:r><w:t>`)
      .replace("CLUSTER", `</w:t></w:r>${complex([item(), item("IJKLMNOP")], "[1,2]")}<w:r><w:t>`)
      .replace("UNKNOWN", `</w:t></w:r>${complex([item("XXXXXXXX")], "[99]")}<w:r><w:t>`)
      .replace("BIBLIOGRAPHY", `</w:t></w:r>${complex([], "Duplicate bibliography entry").replace("ZOTERO_ITEM CSL_CITATION", "ZOTERO_BIBL")}<w:r><w:t>`));
    files["word/footnotes.xml"] = strToU8(strFromU8(files["word/footnotes.xml"])
      .replace("CITATIONFOOT", `</w:t></w:r>${complex([item()], "(Smith, 2024, p. 12)")}<w:r><w:t>`));
    const file = new File([new Uint8Array(zipSync(files)).buffer], "Example.docx");
    const storage = new Map<string, Blob>();
    const created: any[] = [];
    const notices: any[] = [];
    const errors: any[] = [];
    const pool = new LiteraturePool();
    let noteCreations = 0;
    const plugin: any = {
      app: {}, i18n: messages, literaturePool: pool,
      data: {"menu-config": {
        referenceNotebook: "box", referencePath: "/References", useItemKey: false,
        linkTemplate: "unused global template",
        linkTemplatesGroup: [{name: "default", linkTemplate: "({{shortAuthor}}, {{containerTitle}}, {{year}})"}],
      }},
      reference: {checkRefDirExist: async () => { plugin.isRefPathExist = true; }},
      noticer: {info: (...args: any[]) => notices.push(args), error: (...args: any[]) => errors.push(args)},
      database: {
        getImportEntries: async () => entries,
        getContentByKey: async (key: string) => ({...entries.find(e => e.key === key), shortAuthor: key.includes("Smith") ? "Smith" : "Jones", containerTitle: "Nature", year: "2024"}),
      },
      kernelApi: {
        getBlock: async () => ({data: [{type: "d", box: "box", hpath: "/Parent's document"}]}),
        putFile: async (path: string, _: boolean, blob: Blob) => {storage.set(path, blob); return {code: 0};},
        pandoc: async (subdir: string, args: string[]) => {
          writeFileSync(join(dir, "input.docx"), new Uint8Array(await storage.get(`/temp/convert/pandoc/${subdir}/input.docx`)!.arrayBuffer()));
          const params = args.map(arg => /\/scripts\/import-word\.lua$/.test(arg) ? join(__dirname, "../scripts/import-word.lua") : arg);
          execFileSync("pandoc", params, {cwd: dir});
          return {code: 0};
        },
        getFile: async (path: string, type: string) => {
          const local = path.replace(/^\/temp\/convert\/pandoc\/[^/]+\//, "");
          return type === "text" ? readFileSync(join(dir, local), "utf8") : new Response(readFileSync(join(dir, local)));
        },
        readDir: async () => ({code: 0, data: [{name: "media", isDir: true}]}),
        siyuanRequest: async (_: string, {stmt}: any) => {
          assert.match(stmt, /Parent''s document/);
          return {code: 0, data: created.length && !stmt.includes("(2)") ? [{id: "existing"}] : []};
        },
        createDocWithMd: async (notebook: string, path: string, md: string) => {created.push({notebook, path, md}); return {code: 0, data: `doc${created.length}`};},
        removeFile: async (path: string) => {assert.match(path, /^\/temp\/convert\/pandoc\/citation-import-[a-f0-9]{24}$/); return {code: 0};},
      },
    };
    // Expose the actual two-level extracted media tree rather than mocking its content.
    plugin.kernelApi.readDir = async (path: string) => {
      const { readdirSync } = require("node:fs");
      const local = path.replace(/^\/temp\/convert\/pandoc\/[^/]+\//, "");
      return {code: 0, data: readdirSync(join(dir, local), {withFileTypes: true}).map((entry: any) => ({name: entry.name, isDir: entry.isDirectory()}))};
    };
    LiteratureNote.prototype.updateLiteratureNote = async function(key: string, entry: any) {
      noteCreations++;
      pool.set({key: getLiteratureKey(entry, false), id: key.includes("Smith") ? "20261110000000-aaaaaaa" : "20261110000000-bbbbbbb"});
    };
    const manager = new ImportManager(plugin);
    await manager.importWord(file, "parent");
    assert.deepEqual(errors, []);
    assert.equal(created.length, 1);
    const md = created[0].md;
    assert.match(md, /# <span data-type="text" style="color: #[A-F0-9]{6};">Heading<\/span>/);
    assert.match(md, /\| Column/);
    assert.ok(md.includes('Before ((20261110000000-aaaaaaa "(Smith, Nature, 2024)")) after'));
    assert.ok(md.includes('Author<span data-type="sup">1,2#</span> and H<span data-type="sub">2</span>O.'), md);
    const expectedCluster = '((20261110000000-aaaaaaa "(Smith, Nature, 2024)"))((20261110000000-bbbbbbb "(Jones, Nature, 2024)"))';
    assert.ok(md.includes(expectedCluster));
    assert.ok(!md.includes(`(${expectedCluster})`));
    assert.match(md, /\(\(20261110000000-bbbbbbb/);
    assert.ok(md.includes("\\[99\\]"));
    assert.match(md, /Footnote/);
    assert.match(md, /Footnote \(\(20261110000000-aaaaaaa "\(Smith, Nature, 2024\)"\)\)/);
    assert.match(md, /assets\/word-[a-f0-9]+-media-media-[^)]+\.png/);
    assert.doesNotMatch(md, /SIYUANCITATION|ZOTERO_ITEM|CSL_CITATION|ZOTERO_BIBL|Duplicate bibliography entry/);
    assert.ok([...storage.keys()].some(path => path.startsWith("/data/assets/word-")));
    assert.equal(noteCreations, 2);
    assert.deepEqual(notices.find(([message]) => message === messages.wordImport.done)?.[1], {converted: 3, unresolved: 1});

    // Export the imported anchors through the real Word exporter and Lua filters.
    // The host export endpoint is represented by its documented block-ref markers.
    const exportedMarkdown = md.replace(/\(\((\d{14}-[a-z0-9]{7}) "([^"]*)"\)\)/g,
      (_, id, anchor) => `[\\\\exportRef{${anchor}}](siyuan://blocks/${id})`);
    const projectRoot = join(__dirname, "..");
    (globalThis as any).document = {createElement: () => ({click() {}})};
    let downloaded: Blob | undefined;
    (globalThis as any).window.URL = {createObjectURL: (blob: Blob) => {downloaded = blob; return "blob:word-test";}, revokeObjectURL() {}};
    (globalThis as any).window.siyuan.config.export = {};
    const exportPlugin = {...plugin, kernelApi: {
      ...plugin.kernelApi,
      getBlock: async () => ({data: [{content: "Roundtrip"}]}),
      exportMDContent: async () => ({data: {content: exportedMarkdown}}),
      setExport: async () => ({code: 0}),
      pandoc: async (_: string, args: string[]) => {
        const source = storage.get("/temp/convert/pandoc/citation/exportTemp.md")!;
        writeFileSync(join(dir, "exportTemp.md"), await source.text());
        const params = args.map(arg => /\/scripts\/(citation|math|export-word)\.lua$/.test(arg)
          ? join(projectRoot, "scripts", arg.split("/").pop()!) : arg);
        execFileSync("pandoc", params, {cwd: dir});
        return {code: 0};
      },
    }};
    const { ExportManager } = require("../src/export/exportManager");
    await new ExportManager(exportPlugin).export("imported", "word");
    assert.ok(downloaded);
    const roundtrip = prepareZoteroWord(new Uint8Array(await downloaded.arrayBuffer()), "ROUNDTRIP");
    assert.equal(roundtrip.citations.length, 3);
    assert.deepEqual(roundtrip.citations.map(cite => cite.items.map(item => item.id)), [[42], [42, 43], [42]]);
    const doc = new DOMParser().parseFromString(outputXML(roundtrip.data), "application/xml");
    const visibleText = Array.from(doc.getElementsByTagNameNS(ns, "t")).map(node => node.textContent).join("");
    // Both the per-item parentheses and any cluster punctuation were inside refs.
    assert.doesNotMatch(visibleText, /[();]|Smith|Jones|Duplicate bibliography entry/);

    await manager.importWord(file, "parent");
    assert.deepEqual(errors, []);
    assert.equal(noteCreations, 2);
    assert.equal(created[1].path, "/Parent's document/Example (2)");
    assert.equal(opened.length, 2);
    // Custom reference templates already contain their own block references.
    plugin.data["menu-config"].linkTemplatesGroup[0] = {
      name: "custom", customCiteText: true,
      linkTemplate: '(({{citeFileID}} "({{shortAuthor}}, {{year}})"))',
    };
    await manager.importWord(file, "parent");
    assert.deepEqual(errors, []);
    assert.ok(created[2].md.includes('((20261110000000-aaaaaaa "(Smith, 2024)"))((20261110000000-bbbbbbb "(Jones, 2024)"))'));
    // Failed conversion must never create an empty destination document.
    plugin.kernelApi.pandoc = async () => {throw new Error("converter failed");};
    await manager.importWord(file, "parent");
    assert.equal(created.length, 3);
    assert.equal(errors.length, 1);
    assert.match(errors[0][1].error, /converter failed/);
  } finally {
    LiteratureNote.prototype.updateLiteratureNote = originalUpdate;
    Module._load = originalLoad;
    rmSync(dir, {recursive: true, force: true});
  }
});

(async () => {
  for (const [name, run] of tests) {
    await run();
    console.log(`✓ ${name}`);
  }
  console.log(`${tests.length}/${tests.length} Word import tests passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
