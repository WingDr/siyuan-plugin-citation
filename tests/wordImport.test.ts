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

test("bibliographies and non-Zotero fields remain intact", () => {
  const body = complex([item()]).replace("ZOTERO_ITEM CSL_CITATION", "ZOTERO_BIBL") +
    `<w:fldSimple w:instr="PAGE">${text("4")}</w:fldSimple>`;
  const result = prepareZoteroWord(archive(body), "T");
  assert.equal(result.citations.length, 0);
  assert.match(outputXML(result.data), /ZOTERO_BIBL/);
  assert.match(outputXML(result.data), /PAGE/);
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

const entries = [
  { key: "1_Smith2024", itemKey: "ABCDEFGH", citekey: "Smith2024", DOI: "10.1000/ABC", title: "Title A", entry: {data: {itemID: 42, libraryID: 1}} },
  { key: "1_Jones2025", itemKey: "IJKLMNOP", citekey: "Jones2025", title: "Title B", entry: {data: {itemID: 43, libraryID: 1}} },
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

// Execute the real converter for the import manager; mock only SiYuan's host APIs.
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
    writeFileSync(join(dir, "source.md"), '# Heading\n\nBefore CITATIONONE after. CLUSTER UNKNOWN\n\n| Column | Value |\n|---|---|\n| A | B |\n\n![picture](image.png)\n\nWith note[^1].\n\n[^1]: Footnote CITATIONFOOT\n');
    execFileSync("pandoc", ["source.md", "-o", "source.docx"], {cwd: dir});
    const files = unzipSync(readFileSync(join(dir, "source.docx")));
    files["word/document.xml"] = strToU8(strFromU8(files["word/document.xml"])
      .replace("CITATIONONE", `</w:t></w:r>${complex([item()], "[1]", true)}<w:r><w:t>`)
      .replace("CLUSTER", `</w:t></w:r>${complex([item(), item("IJKLMNOP")], "[1,2]")}<w:r><w:t>`)
      .replace("UNKNOWN", `</w:t></w:r>${complex([item("XXXXXXXX")], "[99]")}<w:r><w:t>`));
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
      data: {"menu-config": {referenceNotebook: "box", referencePath: "/References", useItemKey: false}},
      reference: {checkRefDirExist: async () => { plugin.isRefPathExist = true; }},
      noticer: {info: (...args: any[]) => notices.push(args), error: (...args: any[]) => errors.push(args)},
      database: {
        getImportEntries: async () => entries,
        getContentByKey: async (key: string) => ({...entries.find(e => e.key === key), shortAuthor: key.includes("Smith") ? "Smith" : "Jones", year: "2024"}),
      },
      kernelApi: {
        getBlock: async () => ({data: [{type: "d", box: "box", hpath: "/Parent's document"}]}),
        putFile: async (path: string, _: boolean, blob: Blob) => {storage.set(path, blob); return {code: 0};},
        pandoc: async (subdir: string, args: string[]) => {
          writeFileSync(join(dir, "input.docx"), new Uint8Array(await storage.get(`/temp/convert/pandoc/${subdir}/input.docx`)!.arrayBuffer()));
          execFileSync("pandoc", args, {cwd: dir});
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
    assert.match(md, /# Heading/);
    assert.match(md, /\| Column/);
    assert.match(md, /Before \(\(20261110000000-aaaaaaa "\[1\]"\)\) after/);
    assert.match(md, /\(\(20261110000000-bbbbbbb/);
    assert.ok(md.includes("\\[99\\]"));
    assert.match(md, /Footnote/);
    assert.match(md, /Smith, 2024, p\. 12/);
    assert.match(md, /assets\/word-[a-f0-9]+-media-media-[^)]+\.png/);
    assert.doesNotMatch(md, /SIYUANCITATION|ZOTERO_ITEM|CSL_CITATION/);
    assert.ok([...storage.keys()].some(path => path.startsWith("/data/assets/word-")));
    assert.equal(noteCreations, 2);
    assert.deepEqual(notices.find(([message]) => message === messages.wordImport.done)?.[1], {converted: 3, unresolved: 1});
    await manager.importWord(file, "parent");
    assert.deepEqual(errors, []);
    assert.equal(noteCreations, 2);
    assert.equal(created[1].path, "/Parent's document/Example (2)");
    assert.equal(opened.length, 2);
    // Failed conversion must never create an empty destination document.
    plugin.kernelApi.pandoc = async () => {throw new Error("converter failed");};
    await manager.importWord(file, "parent");
    assert.equal(created.length, 2);
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
