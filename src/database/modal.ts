import Fuse from "fuse.js";
import axios from "axios";

import {
  Protyle
} from "siyuan";
import SiYuanPluginCitation from "../index";
import {
  Library,
  loadEntries,
  Entry,
  type EntryData,
  EntryBibLaTeXAdapter,
  EntryCSLAdapter,
  type IIndexable
} from "../database/filesLibrary";
import { 
  type EntryDataZotero,
  EntryZoteroAdapter,
  getTemplateVariablesForZoteroEntry
 } from "./zoteroLibrary";
import {
  SearchDialog
} from "../frontEnd/searchDialog/searchDialog";
import { htmlNotesProcess } from "../utils/notes";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { isDev, REF_DIR_PATH, dataDir } from "../utils/constants";
import { fileSearch, generateFileLinks } from "../utils/util";

const path = window.require("path");
const fs = window.require("fs");

export abstract class DataModal {
  public logger: ILogger;
  public plugin: SiYuanPluginCitation;
  public protyle: Protyle;
  public onSelection: (keys: string[]) => void;
  public abstract buildModal();
  public abstract getContentFromKey(key: string);
  public abstract getCollectedNotesFromKey(key: string);
  public abstract showSearching(protyle:Protyle, onSelection: (keys: string[]) => void);
  public abstract getTotalKeys(): string[];
}

function processKey(key: string): [number, string] {
  if (!key) return [1, key];
  const group = key.split("_");
  if (group.length <= 1 || isNaN(+group[0])) {
    // 整个长度小于等于1（不含“_”或者为空）或者第一个字符不是数字的，都视为非新生成的
    return [1, key];
  } else {
    return [eval(group[0]), group.slice(1).join("_")];
  }
}

export class FilesModal extends DataModal {
  private fuse: Fuse<any>;
  private searchDialog: SearchDialog;
  private library: Library;

  constructor(plugin: SiYuanPluginCitation) {
    super();
    this.plugin = plugin;
    this.logger = createLogger("files modal");
    if (isDev) this.logger.info("从本地文件载入文献库");
  }

  public async buildModal() {
    const options = {
      // isCaseSensitive: false,
      includeScore: true,
      // shouldSort: true,
      includeMatches: true,
      // findAllMatches: false,
      // minMatchCharLength: 1,
      // location: 0,
      threshold: 0.6,
      // distance: 100,
      useExtendedSearch: true,
      ignoreLocation: true,
      // ignoreFieldNorm: false,
      // fieldNormWeight: 1,
      keys: [
        {name: "keystring", getFn: entry => entry.title + "\n" + entry.year + "\n" + entry.authorString}
      ]
    };
    return this.loadLibrary().then(library => {
      if (library) {
        this.plugin.noticer.info(this.plugin.i18n.notices.loadLibrarySuccess.replace("${size}", library.size));
        this.library = library;
        this.fuse = new Fuse(library.entryList, options);
        if (isDev) this.logger.info("Build file modal successfully");
      } else {
        this.plugin.noticer.error(this.plugin.i18n.errors.loadLibraryFailed);
        this.library = null;
        this.fuse = null;
        if (isDev) this.logger.error("Build file modal failed");
      }
    });
  }

  /**
   * show searching dialog
   */
  public showSearching(protyle:Protyle, onSelection: (keys: string[]) => void) {
    this.protyle = protyle;
    if (isDev) this.logger.info("打开搜索界面");
    this.searchDialog = new SearchDialog(this.plugin);
    this.searchDialog.showSearching(this.search.bind(this), onSelection);
  }

  public getContentFromKey (key: string) {
    const [, citekey] = processKey(key);
    const entry = this.library.getTemplateVariablesForCitekey(citekey);
    if (entry.files) entry.files = generateFileLinks(entry.files);
    if (isDev) this.logger.info("文献内容 =>", entry);
    return entry;
  }

  public getCollectedNotesFromKey(key: string) {
    const [, citekey] = processKey(key);
    const entry = this.library.getTemplateVariablesForCitekey(citekey);
    return entry.note;
  }

  public getTotalKeys(): string[] {
    return Object.keys(this.plugin.key2idDict);
  }

  /**
   * Search from the constructed library
   * @param pattern the input string for searching
   * @returns the searching results in list form
   */
  private search(pattern: string) {
    const adaptedSearchPattern = pattern.split(" ").filter(pt => pt != "").reduce((previousValue, currentValue) => previousValue + ` '${currentValue}`, "");
    return this.fuse.search(adaptedSearchPattern);
  }

  private async loadLibrary(): Promise<Library> {
    const logger = createLogger("load library");
    const noticer = this.plugin.noticer;
    const files = await fileSearch(REF_DIR_PATH, this.plugin.noticer);
    const fileContents = files.map(filePath => {
        return fs.readFileSync(filePath, "utf-8");
    });
    if (isDev) logger.info("本地文献文件检索，数量=>", fileContents.length);
    const promises = files.map(filePath => {
        const sName = filePath.split(".");
        const type = sName[sName.length - 1];
        if (type == "json") {
            return {
                entries: loadEntries(
                    fileContents[files.indexOf(filePath)],
                    "csl-json"),
                type: "csl-json"
            };
        } else if (type == "bib") {
            return {
                entries: loadEntries(
                    fileContents[files.indexOf(filePath)],
                    "biblatex"),
                type: "biblatex"
            };
        }
    });
    return Promise.all(promises).then((res) => {
        let adapter: new (data: EntryData) => Entry;
        let idKey: string;
  
        const entries: any[] = [];
        res.forEach(fileEntries => {
            entries.push(...fileEntries.entries.map((e) => {
                switch (fileEntries.type) {
                    case "biblatex":
                      adapter = EntryBibLaTeXAdapter;
                      idKey = "key";
                      break;
                    case "csl-json":
                      adapter = EntryCSLAdapter;
                      idKey = "id";
                      break;
                  }
                return [(e as IIndexable)[idKey], new adapter(e)];
            }));
        });
        const library = new Library(
            Object.fromEntries(
                entries
            ),
        );
        return library;
    }).then(library => {
      if (isDev) logger.info("成功载入文献库，数量=>", library.size);
      return library;
    }).catch((e) => {
      if (isDev) logger.error("载入文献库失败，错误信息=>", e);
      noticer.error(e);
      return null;
    });
  }
}

type ZoteroType = "Zotero" | "Juris-M";
const defaultHeaders = {
  "Content-Type": "application/json",
  "Accept": "application/json"
};
const JSHeaders = {
  "Content-Type": "application/javascript",
  "Accept": "application/json"
};
const contentTranslator = "36a3b0b5-bad0-4a04-b79b-441c7cef77db";

export class ZoteroModal extends DataModal {
  private type: ZoteroType;
  private jsonrpcUrl: string;

  constructor(plugin: SiYuanPluginCitation, zoteroType: ZoteroType) {
    super();
    this.plugin = plugin;
    this.type = zoteroType;
    this.logger = createLogger(`zotero modal: ${zoteroType}`);
    this.jsonrpcUrl = `http://127.0.0.1:${this.getPort(this.type)}/better-bibtex/json-rpc`;
  }

  public async buildModal() {
      if (isDev) this.logger.info(`Build ${this.type} modal successfully`);
  }

  /**
   * show searching dialog
   */
  public async showSearching(protyle:Protyle, onSelection: (keys: string[]) => void) {
    this.protyle = protyle;
    this.onSelection = onSelection;
    if (await this.checkZoteroRunning()) {
      if (isDev) this.logger.info(`${this.type}已运行`);
      const res = await axios({
        method: "get",
        url: `http://127.0.0.1:${this.getPort(this.type)}/better-bibtex/cayw?format=translate&translator=${contentTranslator}&exportNotes=true`,
        headers: defaultHeaders
      });
      if (isDev) this.logger.info(`从${this.type}接收到数据 =>`, res.data);
      const citekey = this.getCitekeysFromZotero(res.data.items);
      if (isDev) this.logger.info("获取到citekey =>", {citekey});
      this.onSelection(citekey);
    } else {
      this.plugin.noticer.error((this.plugin.i18n.errors.zoteroNotRunning as string).replace("${type}", this.type));
    }
  }

  public async getContentFromKey (key: string) {
    if (await this.checkZoteroRunning()) {
      const [libraryID, citekey] = processKey(key);
      if (isDev) this.logger.info(`请求${this.type}导出数据, reqOpt=>`, {citekey: citekey, libraryID: libraryID});
      const res = await axios({
        method: "post",
        url: this.jsonrpcUrl,
        headers: defaultHeaders,
        data: JSON.stringify({
          jsonrpc: "2.0",
          method: "item.export",
          params: [[citekey], contentTranslator, libraryID]
        })
      });
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, JSON.parse(res.data.result[2]));
      const zoteroEntry = new EntryZoteroAdapter(JSON.parse(res.data.result[2]).items[0] as EntryDataZotero);
      const entry = getTemplateVariablesForZoteroEntry(zoteroEntry);
      if (entry.files) entry.files = entry.files.join("\n");
      if (isDev) this.logger.info("文献内容 =>", entry);
      return entry;
    } else {
      this.plugin.noticer.error((this.plugin.i18n.errors.zoteroNotRunning as string).replace("${type}", this.type));
      return null;
    }
  }

  public async getCollectedNotesFromKey(key: string) {
    if (await this.checkZoteroRunning()) {
      const [, citekey] = processKey(key);
      const res = await axios({
        method: "post",
        url: this.jsonrpcUrl,
        headers: defaultHeaders,
        data: JSON.stringify({
          jsonrpc: "2.0",
          method: "item.notes",
          params: [[citekey]]
        })
      });
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, res.data.result[citekey]);
      return (res.data.result[citekey] as string[]).map((singleNote, index) => {
        return `\n\n---\n\n###### Note No.${index+1}\n\n\n\n` + htmlNotesProcess(singleNote.replace(/\\(.?)/g, (m, p1) => p1));
      }).join("\n\n");
    } else {
      this.plugin.noticer.error((this.plugin.i18n.errors.zoteroNotRunning as string).replace("${type}", this.type));
      return "";
    }
  }

  public getTotalKeys(): string[] {
    return Object.keys(this.plugin.key2idDict);
  }

  private getPort(type: ZoteroType): "23119" | "24119" {
    return type === "Zotero" ? "23119" : "24119";
  }

  private getCitekeysFromZotero(items: any[]): string[] {
    if (!items) return [];
    
    const citekeys = items.map((item: any) => {
      if (!item.citekey && !item.citationKey) return null;
      return item.libraryID + "_" + (item.citekey || item.citationKey);
    }).filter(e => !!e);
    if (!citekeys.length) return [];
    return citekeys;
  }

  private async checkZoteroRunning(): Promise<boolean> {
    return axios({
      method: "get",
      url: `http://127.0.0.1:${this.getPort(this.type)}/better-bibtex/cayw?probe=true`
    })
    .then(res => res.data === "ready")
    .catch(e => {
      if (isDev) this.logger.error(e); 
      return false;
    });
  }
}

interface SearchItem {
  libraryID: number,
  itemKey: string,
  citationKey?: string,
  creators: any[],
  year: string,
  title: string,
}

export class ZoteroDBModal extends DataModal {
  private type: ZoteroType;
  private absZoteroJSPath: string;
  private searchOptions: any;
  private fuse: Fuse<any>;
  private searchDialog: SearchDialog;

  constructor(plugin: SiYuanPluginCitation, zoteroType: ZoteroType, private useItemKey = false) {
    super();
    this.plugin = plugin;
    this.type = zoteroType;
    this.logger = createLogger(`zotero DB modal: ${zoteroType}`);
    this.absZoteroJSPath = path.resolve(dataDir, "./plugins/siyuan-plugin-citation/zoteroJS");
    this.searchOptions = {
      // isCaseSensitive: false,
      includeScore: true,
      // shouldSort: true,
      includeMatches: true,
      // findAllMatches: false,
      // minMatchCharLength: 1,
      // location: 0,
      threshold: 0.6,
      // distance: 100,
      useExtendedSearch: true,
      ignoreLocation: true,
      // ignoreFieldNorm: false,
      // fieldNormWeight: 1,
      keys: [
        {name: "keystring", getFn: entry => entry.title + "\n" + entry.year + "\n" + entry.authorString}
      ]
    };
  }

  public async buildModal() {
    if (isDev) this.logger.info(`Build ${this.type} DB modal successfully`);
  }

  /**
   * show searching dialog
   */
  public async showSearching(protyle:Protyle, onSelection: (keys: string[]) => void) {
    this.protyle = protyle;
    if (await this.checkZoteroRunning()) {
      if (isDev) this.logger.info(`${this.type}已运行`);
      const items = await this.getAllItems();
      if (isDev) this.logger.info(`从${this.type}接收到数据 =>`, items);
      if (!this.useItemKey && !items[0].citationKey.length) {
        this.plugin.noticer.error(this.plugin.i18n.errors.bbtDisabled as string);
        return null;
      }
      const searchItems = items.map(item => {
        return new EntryZoteroAdapter(item, this.useItemKey);
      });
      this.fuse = new Fuse(searchItems, this.searchOptions);
      if (isDev) this.logger.info("打开搜索界面");
      this.searchDialog = new SearchDialog(this.plugin);
      this.searchDialog.showSearching(this.search.bind(this), onSelection);
    } else {
      this.plugin.noticer.error((this.plugin.i18n.errors.zoteroNotRunning as string).replace("${type}", this.type));
    }
  }

  public async getContentFromKey (key: string) {
    if (await this.checkZoteroRunning()) {
      let itemKey = this.useItemKey ? key : await this.getItemKeyByCitekey(...processKey(key));
      if (!(await this.checkItemKeyExist(...processKey(itemKey)))) itemKey = this.useItemKey ? await this.getItemKeyByCitekey(...processKey(key)) : key;
      if (!processKey(itemKey)[1].length) {
        this.logger.error("不存在key，key=>", {itemKey});
        return null;
      }
      const res = await this.getItemByItemKey(...processKey(itemKey));
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, res);
      const zoteroEntry = new EntryZoteroAdapter(res as EntryDataZotero, this.useItemKey);
      const entry = getTemplateVariablesForZoteroEntry(zoteroEntry);
      if (entry.files) entry.files = entry.files.join("\n");
      if (isDev) this.logger.info("文献内容 =>", entry);
      return entry;
    } else {
      this.plugin.noticer.error((this.plugin.i18n.errors.zoteroNotRunning as string).replace("${type}", this.type));
      return null;
    }
  }

  public async getCollectedNotesFromKey(key: string) {
    if (await this.checkZoteroRunning()) {
      const itemKey = this.useItemKey ? key : await this.getItemKeyByCitekey(...processKey(key));
      const res = await this.getNotesByItemKey(...processKey(itemKey));
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, res);
      return (res as string[]).map((singleNote, index) => {
        return `\n\n---\n\n###### Note No.${index+1}\n\n\n\n` + htmlNotesProcess(singleNote.replace(/\\(.?)/g, (m, p1) => p1));
      }).join("\n\n");
    } else {
      this.plugin.noticer.error((this.plugin.i18n.errors.zoteroNotRunning as string).replace("${type}", this.type));
      return "";
    }
  }

  public getTotalKeys(): string[] {
    return Object.keys(this.plugin.key2idDict);
  }

  private search(pattern: string) {
    const adaptedSearchPattern = pattern.split(" ").filter(pt => pt != "").reduce((previousValue, currentValue) => previousValue + ` '${currentValue}`, "");
    return this.fuse.search(adaptedSearchPattern);
  }

  private getPort(type: ZoteroType): "23119" | "24119" {
    return type === "Zotero" ? "23119" : "24119";
  }

  private async checkItemKeyExist(libraryID: number, itemKey: string): Promise<boolean> {
    if (!itemKey.length) return false;
    return (await this.callZoteroJS("checkItemKeyExist", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
    `)).itemKeyExist;
  }

  private async checkZoteroRunning(): Promise<boolean> {
    return (await this.callZoteroJS("checkRunning", "")).ready;
  }

  private async getAllItems(): Promise<SearchItem[]> {
    return await this.callZoteroJS("getAllItems", "");
  }

  private async getItemByItemKey(libraryID: number, itemKey: string) {
    return await this.callZoteroJS("getItemByItemKey", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
    `);
  }

  private async getItemKeyByCitekey(libraryID: number, citekey: string) {
    return (await this.callZoteroJS("getItemKeyByCiteKey", `
      var citekey = "${citekey}";
      var libraryID = ${libraryID};
    `)).itemKey;
  }

  private async getNotesByItemKey(libraryID: number, itemKey: string) {
    return await this.callZoteroJS("getNotesByItemKey", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
    `);
  }

  private async callZoteroJS(filename: string, prefix: string) {
    const jsContent = fs.readFileSync(path.join(this.absZoteroJSPath, filename+".ts"), "utf-8");
    if (isDev) this.logger.info("向debug-bridge发送数据，fetchData=>", {
      command: filename,
      data: prefix + "\n" + jsContent
    });
    const Result = await axios({
      method: "post",
      url: `http://127.0.0.1:${this.getPort(this.type)}/debug-bridge/execute?password=CTT`,
      headers: JSHeaders,
      data: prefix + "\n" + jsContent
    }).catch(e => {
      if (isDev) this.logger.error(e);
      return {
        data: JSON.stringify({
          ready: false
        })
      };
    });
    const resData = JSON.parse(Result.data);
    if (isDev) this.logger.info("从debug-bridge接收到数据，resJson=>", resData);
    return resData;
  }
}