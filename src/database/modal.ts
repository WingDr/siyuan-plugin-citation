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
import { isDev, REF_DIR_PATH, STORAGE_NAME } from "../utils/constants";
import { fileSearch, generateFileLinks } from "../utils/util";
import { NoteProcessor } from "../references/noteProcessor";

export abstract class DataModal {
  public logger!: ILogger;
  public plugin!: SiYuanPluginCitation;
  public protyle!: Protyle;
  public selectedList!: string[];
  public onSelection!: (keys: string[]) => void;
  public abstract buildModal():any;
  public abstract getContentFromKey(key: string, shortAuthorLimit?: number):any;
  public abstract getCollectedNotesFromKey(key: string):any;
  public abstract showSearching(protyle:Protyle | null, onSelection: (keys: string[]) => void): void;
  public abstract getTotalKeys(): string[];
  public async getSelectedItems(): Promise<string[]> {
    if (isDev) this.logger.info("该数据模型无法执行此方法，modal=>", this);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async updateDataSourceItem(key: string, content: {[attr: string]: any}) {
    if (isDev) this.logger.info("该数据模型无法执行此方法，modal=>", this);
  }
  public async getAttachmentByItemKey(itemKey: string): Promise<any> {
    return null;
  }
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
  private fuse!: Fuse<any> | null;
  private searchDialog!: SearchDialog;
  private library!: Library | null;

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
        {name: "keystring", getFn: (entry: { title: string; year: string; authorString: string; }) => entry.title + "\n" + entry.year + "\n" + entry.authorString}
      ]
    };
    return this.loadLibrary().then(library => {
      if (library) {
        this.plugin.noticer.info((this.plugin.i18n.notices as any).loadLibrarySuccess, {size: library.size});
        this.library = library;
        this.fuse = new Fuse(library.entryList, options);
        if (isDev) this.logger.info("Build file modal successfully");
      } else {
        this.plugin.noticer.error((this.plugin.i18n.errors as any).loadLibraryFailed);
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

  public getContentFromKey(key: string, shortAuthorLimit: number) {
    const [, citekey] = processKey(key);
    if (!this.library) return null;
    const entry = this.library.getTemplateVariablesForCitekey(citekey);
    if (entry.files) entry.files = generateFileLinks(entry.files);
    if (isDev) this.logger.info("文献内容 =>", entry);
    return entry;
  }

  public getCollectedNotesFromKey(key: string) {
    const [, citekey] = processKey(key);
    if (!this.library) return "";
    const entry = this.library.getTemplateVariablesForCitekey(citekey);
    return entry.note;
  }

  public getTotalKeys(): string[] {
    return this.plugin.literaturePool.keys;
  }

  /**
   * Search from the constructed library
   * @param pattern the input string for searching
   * @returns the searching results in list form
   */
  private search(pattern: string) {
    const adaptedSearchPattern = pattern.split(" ").filter(pt => pt != "").reduce((previousValue, currentValue) => previousValue + ` '${currentValue}`, "");
    return this.fuse!.search(adaptedSearchPattern);
  }

  private async loadLibrary(): Promise<Library | null> {
    const logger = createLogger("load library");
    const noticer = this.plugin.noticer;
    const files = await fileSearch(this.plugin, REF_DIR_PATH, this.plugin.noticer);
    if (isDev) logger.info("本地文献文件检索, fileList=>", {files});
    const fileContents = await Promise.all(files.map( async filePath => {
      return await this.plugin.kernelApi.getFile(filePath, "text") as string;
    }));
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
        let adapter: new (data: EntryData, shortAuthorLimit?: number) => Entry;
        let idKey: string;
  
        const entries: any[] = [];
        res.forEach(fileEntries => {
            entries.push(...fileEntries!.entries.map((e) => {
                switch (fileEntries!.type) {
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
  "Accept": "application/json",
  "Zotero-Allowed-Request": "true"
};
const TextHeaders = {
  "Content-Type": "text/plain",
  "Accept": "application/json",
  "Zotero-Allowed-Request": "true"
}; // 新版Zotero不接受JavaScript传入
const JSHeaders = {
  "Content-Type": "application/javascript",
  "Accept": "application/json",
  "Zotero-Allowed-Request": "true"
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
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
    }
  }

  public async getContentFromKey (key: string, shortAuthorLimit: number = 2) {
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
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, JSON.parse(res.data.result));
      const zoteroEntry = new EntryZoteroAdapter(JSON.parse(res.data.result).items[0] as EntryDataZotero, false, shortAuthorLimit);
      const entry = getTemplateVariablesForZoteroEntry(zoteroEntry);
      if (entry.files) entry.files = entry.files.join("\n");
      if (isDev) this.logger.info("文献内容 =>", entry);
      return entry;
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
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
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
      return "";
    }
  }

  public getTotalKeys(): string[] {
    return this.plugin.literaturePool.keys;
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
    if (!citekeys || !citekeys.length) return [];
    return citekeys as string[];
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
  private fuse!: Fuse<any>;
  private searchDialog!: SearchDialog;
  private useJSHeaders = false;

  constructor(plugin: SiYuanPluginCitation, zoteroType: ZoteroType, private useItemKey = false) {
    super();
    this.plugin = plugin;
    this.type = zoteroType;
    this.logger = createLogger(`zotero DB modal: ${zoteroType}`);
    this.absZoteroJSPath = "/data/plugins/siyuan-plugin-citation/zoteroJS/";
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
        {name: "keystring", getFn: (entry: { title: string; year: string; authorString: string; }) => entry.title + "\n" + entry.year + "\n" + entry.authorString}
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
      const dbSearchDialogType = this.plugin.data[STORAGE_NAME].dbSearchDialogType;
      if (dbSearchDialogType === "SiYuan") {
        const items = await this.getAllItems();
        if (isDev) this.logger.info(`从${this.type}接收到数据 =>`, items);
        if (!this.useItemKey && !items[0].citationKey!.length) {
          this.plugin.noticer.error((this.plugin.i18n.errors as any).bbtDisabled as string);
          return null;
        }
        const searchItems = items.map(item => {
          return new EntryZoteroAdapter(item, this.useItemKey);
        });
        this.fuse = new Fuse(searchItems, this.searchOptions);
        if (isDev) this.logger.info("打开搜索界面, searchItems=>", searchItems);
        this.searchDialog = new SearchDialog(this.plugin);
        const selectedList = this.selectedList.map(key => {
          const item = searchItems.filter(item => item.key == key)[0];
          return item ? {
            key,
            author: item.author[0] ? item.author[0].family! : item.title!,
            year: "" + item.year
          } : {key: "", author: "", year: ""};
        }).filter(item => item.key != "");
        this.searchDialog.showSearching(
          this.search.bind(this), 
          onSelection,
          selectedList
        );
      } else if (dbSearchDialogType === "Zotero") {
        const results = await this._citeWithZoteroDialog();
        if (isDev) this.logger.info("在Zotero中选择文献, results=>", results);
        return onSelection(results.map(res => {
          return `${res.libraryID}_${res.key}`;
        }));
      }
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
    }
  }

  public async getContentFromKey (key: string, shortAuthorLimit: number = 2) {
    const itemKey = await this.checkBeforeRunning(key);
    if (itemKey) {
      const res = await this.getItemByItemKey(...processKey(itemKey));
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, res);
      if (("ready" in res && !res.ready) || !res.itemExist) return null;
      const zoteroEntry = new EntryZoteroAdapter(res as EntryDataZotero, this.useItemKey, shortAuthorLimit);
      const entry = getTemplateVariablesForZoteroEntry(zoteroEntry);
      if (entry.files) entry.files = entry.files.join("\n");
      if (isDev) this.logger.info("文献内容 =>", entry);
      return entry;
    } else return itemKey;
  }

  public async getCollectedNotesFromKey(key: string) {
    const itemKey = await this.checkBeforeRunning(key);
    if (itemKey) {
      const res = await this.getNotesByItemKey(...processKey(itemKey));
      if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, res);
      return (await Promise.all((res as any[]).map( async (singleNote, index) => {
        const processor = new NoteProcessor(this.plugin);
        return `\n\n---\n\n###### Note No.${index+1}\t[[Locate]](zotero://select/items/0_${singleNote.key}/)\t[[Open]](zotero://note/u/${singleNote.key}/)\n\n\n\n` + await processor.processNote(htmlNotesProcess(singleNote.note.replace(/\\(.?)/g, (m: any, p1: any) => p1)));
      }))).join("\n\n");
    } else return "";
  }

  public getTotalKeys(): string[] {
    return this.plugin.literaturePool.keys;
  }

  public async getSelectedItems(): Promise<string[]> {
    if (await this.checkZoteroRunning()) {
      return await this._getSelectedItems();
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
      return [];
    }
  }

  public async updateDataSourceItem(key: string, content: {[attr: string]: any}) {
    const itemKey = await this.checkBeforeRunning(key);
    if (itemKey) {
      if (isDev) this.logger.info("更新Zotero数据, detail=>", {key, content});
      Object.keys(content).forEach(attr => {
        switch (attr) {
          case "backlink": this._updateURLToItem(...processKey(itemKey), content[attr].title, content[attr].url); break;
          case "tags": this._addTagsToItem(...processKey(itemKey), content[attr]);
        }
      });
    }
  }

  public async getAttachmentByItemKey(itemKey: string): Promise<any> {
    return await this._callZoteroJS("getAttachmentByItemKey", `
      var key = "${itemKey}";
      var libraryID = 1;
    `);
  }

  private async checkBeforeRunning(key: string): Promise<string | null | false> {
    if (await this.checkZoteroRunning()) {
      let itemKey = this.useItemKey ? key : await this.getItemKeyByCitekey(...processKey(key));
      if (!(await this.checkItemKeyExist(...processKey(itemKey)))) itemKey = this.useItemKey ? await this.getItemKeyByCitekey(...processKey(key)) : key;
      if (!processKey(itemKey)[1]?.length) {
        this.logger.error("不存在key，key=>", {itemKey, key, processed: processKey(key)});
        return null;
      }
      return itemKey;
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
      return false;
    }
  }

  private search(pattern: string) {
    const adaptedSearchPattern = pattern.split(" ").filter(pt => pt != "").reduce((previousValue, currentValue) => previousValue + ` '${currentValue}`, "");
    return this.fuse.search(adaptedSearchPattern);
  }

  private _getPort(type: ZoteroType): "23119" | "24119" {
    return type === "Zotero" ? "23119" : "24119";
  }

  private async _addTagsToItem(libraryID: number, itemKey: string, tags: string) {
    return await this._callZoteroJS("addTagsToItem", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
      var tags = "${tags}";
    `);
  }

  private async checkItemKeyExist(libraryID: number, itemKey: string): Promise<boolean> {
    if (!itemKey.length) return false;
    return (await this._callZoteroJS("checkItemKeyExist", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
    `)).itemKeyExist;
  }

  private async checkZoteroRunning(): Promise<boolean> {
    return (await this._callZoteroJS("checkRunning", "")).ready;
  }

  private async _citeWithZoteroDialog(): Promise<{key: string, libraryID: number}[]> {
    return await this._callZoteroJS("citeWithZoteroDialog", "");
  }

  private async getAllItems(): Promise<SearchItem[]> {
    return await this._callZoteroJS("getAllItems", "");
  }

  private async getItemByItemKey(libraryID: number, itemKey: string) {
    return await this._callZoteroJS("getItemByItemKey", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
    `);
  }

  private async getItemKeyByCitekey(libraryID: number, citekey: string) {
    return (await this._callZoteroJS("getItemKeyByCiteKey", `
      var citekey = "${citekey}";
      var libraryID = ${libraryID};
    `)).itemKey;
  }

  private async getNotesByItemKey(libraryID: number, itemKey: string) {
    return await this._callZoteroJS("getNotesByItemKey", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
    `);
  }

  private async _getSelectedItems() {
    return await this._callZoteroJS("getSelectedItems", "");
  }

  private async _updateURLToItem(libraryID: number, itemKey: string, title: string, url: string) {
    return await this._callZoteroJS("updateURLToItem", `
      var key = "${itemKey}";
      var libraryID = ${libraryID};
      var url = "${url}";
      var title = "${title}";
    `);
  }

  private async _callZoteroJS(filename: string, prefix: string) {
    const password = this.plugin.data[STORAGE_NAME].dbPassword;
    const jsContent = await this.plugin.kernelApi.getFile(this.absZoteroJSPath + filename + ".ts", "text");
    if (isDev) this.logger.info("向debug-bridge发送数据，fetchData=>", {
      command: filename,
      data: prefix + "\n" + jsContent
    });
    const contentHeaders = this.useJSHeaders ? JSHeaders : TextHeaders;
    const Result = await this.plugin.networkManager.sendRequest({
      method: "post",
      url: `http://127.0.0.1:${this._getPort(this.type)}/debug-bridge/execute?password=${password}`,
      headers: {
        ...contentHeaders,
        Authorization: `Bearer ${password}`
      },
      data: prefix + "\n" + jsContent
    }).catch(async (e: { response: { status: number; }; }) => {
      if (isDev) this.logger.error("访问Zotero发生错误, error=>", e);
      if (e.response?.status == 401) this.plugin.noticer.error((this.plugin.i18n.errors as any).wrongDBPassword); // 密码错误
      else if (e.response?.status == 403) this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroRequestForbidden as string), {type: this.type}); // 访问请求被禁止，建议更新到最新版本citation插件
      else if (e.response?.status == 404) this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type}); //找不到Zotero或者debug-bridge
      else if (e.response?.status == 0) this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroCannotReached as string), {type: this.type}); //无法与Zotero通信，没安装Unblock浏览器插件
      else if (e.response?.status == 400) {
        this.useJSHeaders = !this.useJSHeaders;
        const data = await this._callZoteroJS(filename, prefix);
        return {data:JSON.stringify(data)};
      } //新版Zotero
      return {
        data: JSON.stringify({
          ready: false
        })
      };
    });
    if (isDev) this.logger.info("从debug-bridge接收到结果，resJson=>", Result);
    const resData = JSON.parse(Result.data);
    if (isDev) this.logger.info("从debug-bridge接收到数据，resJson=>", resData);
    return resData;
  }
}

/**
 * ZoteroWebAPIModal - 使用Zotero 7本地WebAPI访问数据
 * 支持通过HTTP REST API获取items数据
 */
export class ZoteroWebAPIModal extends DataModal {
  private type: ZoteroType;
  private apiBaseUrl: string;
  private searchOptions: any;
  private fuse!: Fuse<any>;
  private searchDialog!: SearchDialog;
  private userId: string = "0"; // 本地API使用userId 0

  constructor(plugin: SiYuanPluginCitation, zoteroType: ZoteroType, useItemKey?: boolean) {
    super();
    this.plugin = plugin;
    this.type = zoteroType;
    this.logger = createLogger(`zotero WebAPI modal: ${zoteroType}`);
    this.apiBaseUrl = `http://127.0.0.1:${this._getPort(this.type)}/api`;
    // Web API 模式强制使用 itemKey，不依赖 Better BibTeX
    this.useItemKey = true;
    this.searchOptions = {
      includeScore: true,
      includeMatches: true,
      threshold: 0.6,
      useExtendedSearch: true,
      ignoreLocation: true,
      keys: [
        {name: "keystring", getFn: (entry: { title: string; year: string; authorString: string; }) => entry.title + "\n" + entry.year + "\n" + entry.authorString}
      ]
    };
    if (isDev) this.logger.info("Web API 模式已启用，强制使用 itemKey 作为索引");
  }

  public async buildModal() {
    if (isDev) this.logger.info(`Build ${this.type} WebAPI modal successfully`);
  }

  /**
   * show searching dialog
   */
  public async showSearching(protyle: Protyle, onSelection: (keys: string[]) => void) {
    this.protyle = protyle;
    if (await this.checkZoteroRunning()) {
      if (isDev) this.logger.info(`${this.type} WebAPI已运行`);
      const items = await this.getAllItems();
      if (isDev) this.logger.info(`从${this.type} WebAPI接收到数据 =>`, items);

      const searchItems = items.map(item => {
        return new EntryZoteroAdapter(item, this.useItemKey);
      });
      this.fuse = new Fuse(searchItems, this.searchOptions);
      if (isDev) this.logger.info("打开搜索界面, searchItems=>", searchItems);
      this.searchDialog = new SearchDialog(this.plugin);
      const selectedList = this.selectedList.map(key => {
        const item = searchItems.filter(item => item.key == key)[0];
        return item ? {
          key,
          author: item.author[0] ? item.author[0].family! : item.title!,
          year: "" + item.year
        } : {key: "", author: "", year: ""};
      }).filter(item => item.key != "");
      this.searchDialog.showSearching(
        this.search.bind(this),
        onSelection,
        selectedList
      );
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
    }
  }

  public async getContentFromKey(key: string, shortAuthorLimit: number = 2) {
    if (await this.checkZoteroRunning()) {
      const [libraryID, itemKey] = processKey(key);
      if (isDev) this.logger.info(`请求${this.type} WebAPI导出数据, reqOpt=>`, {itemKey: itemKey, libraryID: libraryID});
      const res = await this.getItemByItemKey(libraryID, itemKey);
      if (isDev) this.logger.info(`请求${this.type} WebAPI数据返回, resJson=>`, res);
      if (!res || !res.data) return null;

      // 获取附件和注释
      const children = await this.getChildrenByItemKey(libraryID, itemKey);
      const zoteroData = this._convertWebAPIItemToZoteroData(res, children);

      const zoteroEntry = new EntryZoteroAdapter(zoteroData, this.useItemKey, shortAuthorLimit);
      const entry = getTemplateVariablesForZoteroEntry(zoteroEntry);
      if (entry.files) entry.files = entry.files.join("\n");
      if (isDev) this.logger.info("文献内容 =>", entry);
      return entry;
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
      return null;
    }
  }

  public async getCollectedNotesFromKey(key: string) {
    if (await this.checkZoteroRunning()) {
      const [libraryID, itemKey] = processKey(key);
      const notes = await this.getNotesByItemKey(libraryID, itemKey);
      if (isDev) this.logger.info(`请求${this.type} WebAPI笔记返回, resJson=>`, notes);
      return (await Promise.all(notes.map(async (singleNote: any, index: number) => {
        const processor = new NoteProcessor(this.plugin);
        const noteContent = singleNote.data.note || "";
        return `\n\n---\n\n###### Note No.${index+1}\t[[Locate]](zotero://select/items/${singleNote.key}/)\n\n\n\n` + await processor.processNote(htmlNotesProcess(noteContent.replace(/\\(.?)/g, (m: any, p1: any) => p1)));
      }))).join("\n\n");
    } else {
      this.plugin.noticer.error(((this.plugin.i18n.errors as any).zoteroNotRunning as string), {type: this.type});
      return "";
    }
  }

  public getTotalKeys(): string[] {
    return this.plugin.literaturePool.keys;
  }

  private search(pattern: string) {
    const adaptedSearchPattern = pattern.split(" ").filter(pt => pt != "").reduce((previousValue, currentValue) => previousValue + ` '${currentValue}`, "");
    return this.fuse.search(adaptedSearchPattern);
  }

  private _getPort(type: ZoteroType): "23119" | "24119" {
    return type === "Zotero" ? "23119" : "24119";
  }

  private async checkZoteroRunning(): Promise<boolean> {
    return axios({
      method: "get",
      url: `${this.apiBaseUrl}/users/${this.userId}/items?limit=1`,
      headers: {
        "Zotero-API-Version": "3"
      }
    })
    .then(res => Array.isArray(res.data))
    .catch(e => {
      if (isDev) this.logger.error(e);
      return false;
    });
  }

  private async getAllItems(): Promise<EntryDataZotero[]> {
    const items: any[] = [];
    let start = 0;
    const limit = 100;

    while (true) {
      const res = await axios({
        method: "get",
        url: `${this.apiBaseUrl}/users/${this.userId}/items?start=${start}&limit=${limit}&itemType=-attachment || -note || -annotation`,
        headers: {
          "Zotero-API-Version": "3"
        }
      });

      if (!res.data || res.data.length === 0) break;
      items.push(...res.data);
      if (res.data.length < limit) break;
      start += limit;
    }

    if (isDev) this.logger.info(`从WebAPI获取到${items.length}个items`);
    return items.map(item => this._convertWebAPIItemToZoteroData(item));
  }

  private async getItemByItemKey(libraryID: number, itemKey: string) {
    return axios({
      method: "get",
      url: `${this.apiBaseUrl}/users/${this.userId}/items/${itemKey}`,
      headers: {
        "Zotero-API-Version": "3"
      }
    })
    .then(res => res.data)
    .catch(e => {
      if (isDev) this.logger.error("获取item失败", e);
      return null;
    });
  }

  private async getNotesByItemKey(libraryID: number, itemKey: string): Promise<any[]> {
    return axios({
      method: "get",
      url: `${this.apiBaseUrl}/users/${this.userId}/items/${itemKey}/children`,
      headers: {
        "Zotero-API-Version": "3"
      }
    })
    .then(res => {
      return res.data.filter((child: any) => child.data.itemType === "note");
    })
    .catch(e => {
      if (isDev) this.logger.error("获取notes失败", e);
      return [];
    });
  }

  private async getChildrenByItemKey(libraryID: number, itemKey: string): Promise<any[]> {
    return axios({
      method: "get",
      url: `${this.apiBaseUrl}/users/${this.userId}/items/${itemKey}/children`,
      headers: {
        "Zotero-API-Version": "3"
      }
    })
    .then(res => res.data)
    .catch(e => {
      if (isDev) this.logger.error("获取children失败", e);
      return [];
    });
  }

  /**
   * 将WebAPI返回的item格式转换为EntryDataZotero格式
   */
  private _convertWebAPIItemToZoteroData(webAPIItem: any, children: any[] = []): EntryDataZotero {
    const data = webAPIItem.data;
    const library = webAPIItem.library;

    // 处理附件
    const attachments = children
      .filter(child => child.data.itemType === "attachment")
      .map(attach => {
        const attachData = attach.data;
        const filePath = attach.links?.enclosure?.href?.replace(/^file:\/\//, "") || "";
        return {
          key: attach.key,
          title: attachData.title || attachData.filename || "Attachment",
          path: filePath,
          select: `zotero://select/library/items/${attach.key}`,
          contentType: attachData.contentType,
          filename: attachData.filename
        };
      });

    // 处理笔记
    const notes = children
      .filter(child => child.data.itemType === "note")
      .map(note => {
        return {
          key: note.key,
          note: note.data.note || "",
          itemType: "note"
        };
      });

    // 处理注释（如果有）
    const annotations: any[] = [];

    // 从 extra 字段提取 Citation Key
    // Better BibTeX 可能使用多种格式存储 Citation Key
    let citekey = "";
    if (data.extra) {
      const patterns = [
        /Citation Key:\s*(.+)/i,     // Better BibTeX 标准格式
        /bibtex:\s*(.+)/i,            // 旧版格式
        /bibtex\*:\s*(.+)/i,          // 带星号格式
        /tex\.ids:\s*(.+)/i,          // tex.ids 格式
      ];

      for (const pattern of patterns) {
        const match = data.extra.match(pattern);
        if (match) {
          // 提取第一行作为 citekey（避免多行的情况）
          citekey = match[1].split('\n')[0].trim();
          break;
        }
      }
    }

    return {
      abstractNote: data.abstractNote,
      accessDate: data.accessDate,
      attachments: attachments,
      annotations: annotations,
      citekey: citekey,
      citationKey: citekey,
      conferenceName: data.conferenceName,
      creators: data.creators,
      thesisType: data.thesisType,
      date: data.date,
      dateAdded: data.dateAdded,
      dateModified: data.dateModified,
      DOI: data.DOI,
      edition: data.edition,
      eprint: data.eprint,
      eprinttype: data.eprinttype,
      ISBN: data.ISBN,
      ISSN: data.ISSN,
      itemID: library.id,
      itemKey: webAPIItem.key,
      itemType: data.itemType,
      language: data.language,
      libraryID: library.id,
      journalAbbreviation: data.journalAbbreviation,
      notes: notes,
      numPages: data.numPages,
      pages: data.pages,
      place: data.place,
      primaryClass: data.primaryClass,
      proceedingsTitle: data.proceedingsTitle,
      publisher: data.publisher,
      publicationTitle: data.publicationTitle,
      relations: data.relations,
      tags: data.tags,
      title: data.title,
      university: data.university,
      url: data.url,
      volume: data.volume
    };
  }
}