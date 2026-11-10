import { openTab } from "siyuan";
import type SiYuanPluginCitation from "../index";
import { STORAGE_NAME } from "../utils/constants";
import { LiteratureNote } from "../references/literatureNote";
import { getLiteratureKey } from "../references/pool";
import { CitationMatcher, citationItemText, markdownText, prepareZoteroWord, staticReference, type ImportEntry } from "./zoteroWord";

export class ImportManager {
  private importing = false;

  constructor(private plugin: SiYuanPluginCitation) {}

  public chooseWord(parentID: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".docx";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void this.importWord(file, parentID);
    }, { once: true });
    input.click();
  }

  public async importWord(file: File, parentID: string) {
    const messages = (this.plugin.i18n as any).wordImport as Record<string, string>;
    if (this.importing) {
      this.plugin.noticer.info(messages.busy);
      return;
    }
    if (!/\.docx$/i.test(file.name)) {
      this.plugin.noticer.error(messages.docxOnly);
      return;
    }
    this.importing = true;
    const random = new Uint8Array(12);
    window.crypto.getRandomValues(random);
    const token = Array.from(random, n => n.toString(16).padStart(2, "0")).join("");
    const dir = `citation-import-${token}`;
    const temp = `/temp/convert/pandoc/${dir}`;
    const api = this.plugin.kernelApi;
    try {
      this.plugin.noticer.info(messages.importing);
      const parents = (await api.getBlock(parentID)).data;
      const parent = Array.isArray(parents) ? parents[0] : undefined;
      if (!parent || parent.type !== "d") throw new Error(messages.parentMissing);
      const prepared = prepareZoteroWord(new Uint8Array(await file.arrayBuffer()), token);
      if (prepared.citations.length) {
        await this.plugin.reference.checkRefDirExist();
        if (!this.plugin.data[STORAGE_NAME].referenceNotebook || !this.plugin.isRefPathExist) {
          throw new Error(messages.libraryMissing);
        }
      }
      await api.putFile(`${temp}/input.docx`, false, new Blob([new Uint8Array(prepared.data).buffer]));
      const conversion = await api.pandoc(dir, [
        "input.docx", "--from=docx",
        "--to=markdown-grid_tables-simple_tables-multiline_tables-link_attributes-header_attributes-fenced_divs-bracketed_spans-native_divs-native_spans",
        "--wrap=none", "--extract-media=media", "--output=output.md",
      ]);
      if (conversion.code !== 0) throw new Error(conversion.msg);
      let markdown = await api.getFile(`${temp}/output.md`, "text");
      if (typeof markdown !== "string") throw new Error(messages.conversionFailed);
      markdown = await this.copyMedia(markdown, temp, token);

      const entries = prepared.citations.length ? await this.plugin.database.getImportEntries() : [];
      const matcher = new CitationMatcher(entries as ImportEntry[]);
      const notes = new LiteratureNote(this.plugin);
      const resolved = new Map<string, { id: string; entry: ImportEntry }>();
      let converted = 0;
      let unresolved = prepared.malformed;
      for (const citation of prepared.citations) {
        // Only fields that survived conversion (e.g. not deleted text) require notes.
        if (!markdown.includes(citation.marker)) continue;
        const matches = citation.items.map(item => matcher.match(item));
        let replacement = markdownText(citation.text);
        if (matches.every(Boolean)) {
          const links: string[] = [];
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i]!;
            let reference = resolved.get(match.key);
            if (!reference) {
              const entry = await this.plugin.database.getContentByKey(match.key);
              if (!entry) break;
              const useItemKey = this.plugin.data[STORAGE_NAME].useItemKey;
              const finalKey = getLiteratureKey(entry, useItemKey);
              let id = this.plugin.literaturePool.get(finalKey) || this.plugin.literaturePool.get(match.key);
              if (!id) {
                // Existing notes are reused without refreshing or touching their user data.
                await notes.updateLiteratureNote(match.key, entry, { noConfirmUserData: false });
                id = this.plugin.literaturePool.get(finalKey) || this.plugin.literaturePool.get(match.key);
              }
              if (!id) throw new Error(messages.noteFailed);
              reference = { id, entry };
              resolved.set(match.key, reference);
            }
            const text = matches.length === 1 && citation.text
              ? citation.text : citationItemText(citation.items[i], reference.entry);
            links.push(staticReference(reference.id, text));
          }
          if (links.length === matches.length) {
            replacement = links.length === 1 ? links[0] : `(${links.join("; ")})`;
            converted++;
          } else unresolved++;
        } else unresolved++;
        // Replace literal tokens after conversion so Pandoc cannot escape SiYuan references.
        markdown = markdown.split(citation.marker).join(replacement);
      }
      const title = file.name.replace(/\.docx$/i, "").replace(/[\/\\\r\n]/g, " ").trim() || "Word";
      const path = await this.availablePath(parent.box, parent.hpath, title);
      const result = await api.createDocWithMd(parent.box, path, markdown);
      if (result.code !== 0 || typeof result.data !== "string") throw new Error(result.msg || messages.noteFailed);
      this.plugin.noticer.info(messages.done, { converted, unresolved });
      if (!prepared.citations.length && !prepared.malformed) this.plugin.noticer.info(messages.noFields);
      await openTab({ app: this.plugin.app, doc: { id: result.data } });
    } catch (error) {
      this.plugin.noticer.error(messages.failed, { error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.importing = false;
      // Only remove this import's unique temporary conversion directory.
      try { await api.removeFile(temp); } catch (error) { console.warn("Word import cleanup failed", error); }
    }
  }

  private async availablePath(notebook: string, parentPath: string, title: string): Promise<string> {
    const api = this.plugin.kernelApi;
    const escape = (value: string) => value.replace(/'/g, "''");
    for (let n = 1; n <= 1000; n++) {
      const path = `${parentPath}/${title}${n === 1 ? "" : ` (${n})`}`;
      const result = await api.siyuanRequest("/api/query/sql", {
        stmt: `SELECT id FROM blocks WHERE box = '${escape(notebook)}' AND hpath = '${escape(path)}' AND type = 'd' LIMIT 1`,
      });
      if (result.code !== 0 || !Array.isArray(result.data)) throw new Error(result.msg || "Invalid document query");
      if (!result.data.length) return path;
    }
    throw new Error("Too many documents with the same title");
  }

  private async copyMedia(markdown: string, temp: string, token: string): Promise<string> {
    const api = this.plugin.kernelApi;
    const copy = async (relative: string) => {
      const result = await api.readDir(`${temp}/${relative}`);
      if (result.code !== 0 || !Array.isArray(result.data)) throw new Error(result.msg || "Cannot read imported media");
      for (const file of result.data as { name: string; isDir: boolean; isSymlink?: boolean }[]) {
        if (file.isSymlink || !file.name || /[\/\\]/.test(file.name) || file.name === "." || file.name === "..") continue;
        const source = `${relative}/${file.name}`;
        if (file.isDir) await copy(source);
        else {
          const target = `assets/word-${token}-${source.replace(/[\/\\]/g, "-")}`;
          const response = await api.getFile(`${temp}/${source}`, "any");
          if (!(response instanceof Response) || !response.ok) throw new Error(`Cannot read ${source}`);
          await api.putFile(`/data/${target}`, false, await response.blob());
          markdown = markdown.split(source).join(target);
        }
      }
    };
    // Pandoc creates this directory only when the document has embedded media.
    if (/\bmedia\//.test(markdown)) await copy("media");
    return markdown;
  }
}
