import Fuse from "fuse.js";
import axios from "axios";

import {
  Dialog, Protyle
} from "siyuan";
import SiYuanPluginCitation from "../index";
import {
  Library,
  loadEntries,
  Entry,
  EntryData,
  EntryBibLaTeXAdapter,
  EntryCSLAdapter,
  IIndexable
} from "../database/filesLibrary";
import { 
  EntryDataZotero,
  EntryZoteroAdapter,
  getTemplateVariablesForZoteroEntry
 } from "./zoteroLibrary";
import { createLogger, ILogger } from "../utils/simple-logger";
import { isDev, REF_DIR_PATH } from "../utils/constants";
import { fileSearch, generateFileLinks } from "../utils/util";

export abstract class DataModal {
  public logger: ILogger;
  public plugin: SiYuanPluginCitation;
  public protyle: Protyle;
  public onSelection: (citekey: string) => void;
  public abstract buildModal();
  public abstract getContentFromCitekey(citekey: string);
  public abstract getCollectedNotesFromCitekey(citekey: string);
  public abstract showSearching(protyle:Protyle, onSelection: (citekey: string) => void);
  public abstract getTotalCitekeys(): string[];
}


export class FilesModal extends DataModal {
  private fuse: Fuse<any>;
  private resList: any[];
  private searchDialog: Dialog;
  private selector: number;
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
        this.plugin.noticer.info(this.plugin.i18n.loadLibrarySuccess.replace("${size}", library.size));
        this.library = library;
        this.fuse = new Fuse(library.entryList, options);
        if (isDev) this.logger.info("Build file modal successfully");
      } else {
        this.plugin.noticer.error(this.plugin.i18n.loadLibraryFailed);
        this.library = null;
        this.fuse = null;
        if (isDev) this.logger.error("Build file modal failed");
      }
    });
  }

  /**
   * show searching dialog
   */
  public showSearching(protyle:Protyle, onSelection: (citekey: string) => void) {
    this.protyle = protyle;
    this.onSelection = onSelection;
    const input = document.createElement("input");
    input.className = "b3-text-field b3-text-field--text fn-block";
    input.setAttribute("style", "width: 100%");
    input.placeholder = "Searching literature";
    if (isDev) this.logger.info("打开搜索界面");
    this.searchDialog = new Dialog({
        content: '<div class="plugin-citation__search-tab__input-container fn-block" id="input-container"></div><div class="search__layout plugin-citation__search-tab__result-container" id="result-container"><ul></ul></div>',
        width: this.plugin.isMobile ? "120vw" : "520px",
        height: "40vh"
    });
    this.searchDialog.element.querySelector(".b3-dialog__header").className = "resize__move b3-dialog__header fn__none-custom";
    this.searchDialog.element.querySelectorAll("#input-container").item(0).appendChild(input);
    input.addEventListener("input", () => {
      const formerTable = this.searchDialog.element.getElementsByTagName("ul")[0];
      const resContainer = this.searchDialog.element.querySelectorAll("#result-container").item(0);
      resContainer.removeChild(formerTable);
      const searchRes = this.search(input.value);
      // if (isDev) this.logger.info("search results =>", searchRes);
      const resTable = this.resultTableConstructor(searchRes);
      resContainer.appendChild(resTable);
      this.selector = 0;
      if (searchRes.length) {
        this.searchDialog.element.getElementsByTagName("li").item(0).className = "b3-list-item b3-list-item--focus";
      }
    });
    input.onkeydown = ev => this.keyboardReaction(ev);
    input.focus();
  }

  public getContentFromCitekey (citekey: string) {
    const entry = this.library.getTemplateVariablesForCitekey(citekey);
    if (entry.files) entry.files = generateFileLinks(entry.files);
    return entry;
  }

  public getCollectedNotesFromCitekey(citekey: string) {
    const entry = this.library.getTemplateVariablesForCitekey(citekey);
    return entry.note;
  }

  public getTotalCitekeys(): string[] {
      return Object.keys(this.library.entries);
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

  /**
   * Construct the shown results
   * @param resList the searching result list
   * @returns HTMLElement of the result table
   */
  private resultTableConstructor(resList: any[]): HTMLUListElement {
    const content = document.createElement("ul");
    content.className = "fn__flex-1 search__list b3-list b3-list--background";
    this.resList = resList;
    resList.forEach(res => {
        const singleRes = document.createElement("li");
        const literatureContent = document.createElement("div");
        literatureContent.className = "plugin-citation__search-item";
        literatureContent.setAttribute("data-type", "search-item");
        literatureContent.setAttribute("data-search-id", res.item.id);
        const itemContent = this.matchHighlight(res.matches[0]);
        literatureContent.innerHTML = `<div class="b3-list-item__text" style="font-weight:bold;border-bottom:0.5px solid #CCC"> ${itemContent.title}</div><div class="b3-list-item__text">${itemContent.year} \t | \t ${itemContent.authorString}</div>`;
        singleRes.className = "b3-list-item";
        singleRes.appendChild(literatureContent);
        content.appendChild(singleRes);
        singleRes.addEventListener("click", (ev) => this.clickReaction(ev));
    });
    return content;
  }

  private matchHighlight(match) {
    // if (isDev) this.logger.info("搜索匹配=>", match);
    let contentString = match.value as string;
    const indices = (match.indices as number[][]).sort((a,b) => b[0] - a[0]);
    indices.forEach(indice => {
      contentString = contentString.slice(0, indice[0]) + "<mark>" 
                    + contentString.slice(indice[0], indice[1]+1) + "</mark>"
                    + contentString.slice(indice[1]+1);
    });
    const content = contentString.split("\n");
    return {
      title: content[0],
      year: content[1],
      authorString: content[2]
    };
  }

  private clickReaction(ev: MouseEvent) {
    const target = ev.currentTarget as HTMLElement;
    const id = target.children.item(0).getAttribute("data-search-id");
    this.searchDialog.destroy();
    this.onSelection(id);
  }

  private keyboardReaction(ev: KeyboardEvent) {
    if (ev.key == "ArrowUp") {
      ev.preventDefault();
      this.changeSelection(false);
    } else if (ev.key == "ArrowDown") {
      ev.preventDefault();
      this.changeSelection(true);
    } else if (ev.key == "Enter") {
      const id = this.searchDialog.element.getElementsByTagName("li").item(this.selector).children.item(0).getAttribute("data-search-id");
      this.searchDialog.destroy();
      this.onSelection(id);
    }
  }

  private changeSelection(plus: boolean) {
    const formerSelector = this.selector;
    const table = this.searchDialog.element.getElementsByTagName("li");
    if (!plus && this.selector == 0) {
      this.selector = this.resList.length - 1;
    } else if (plus && this.selector == this.resList.length - 1) {
      this.selector = 0;
    } else {
      this.selector += plus ? 1 : -1;
    }
    table.item(this.selector).className = "b3-list-item b3-list-item--focus";
    table.item(formerSelector).className = "b3-list-item";
    table.item(this.selector).scrollIntoView({behavior: "smooth", block: "center"});
  }

  private async loadLibrary(): Promise<Library> {
    const logger = createLogger("load library");
    const noticer = this.plugin.noticer;
    const files = await fileSearch(REF_DIR_PATH, this.plugin.noticer);
    const fs = window.require("fs");
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
  public async showSearching(protyle:Protyle, onSelection: (citekey: string) => void) {
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
      this.getCitekeysFromZotero(res.data.items).forEach(citekey => {
        this.onSelection(citekey);
      });
    } else {
      this.plugin.noticer.error((this.plugin.i18n.zoteroNotRunning as string).replace("${type}", this.type));
    }
  }

  public async getContentFromCitekey (citekey: string) {
    const res = await axios({
      method: "post",
      url: this.jsonrpcUrl,
      headers: defaultHeaders,
      data: JSON.stringify({
        jsonrpc: "2.0",
        method: "item.export",
        params: [[citekey], contentTranslator]
      })
    });
    if (isDev) this.logger.info(`请求${this.type}数据返回, resJson=>`, JSON.parse(res.data.result[2]));
    const zoteroEntry = new EntryZoteroAdapter(JSON.parse(res.data.result[2]).items[0] as EntryDataZotero);
    const entry = getTemplateVariablesForZoteroEntry(zoteroEntry);
    if (entry.files) entry.files = entry.files.join("\n");
    return entry;
  }

  public async getCollectedNotesFromCitekey(citekey: string) {
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
    return res.data.result[citekey];
  }

  public getTotalCitekeys(): string[] {
    return Object.keys(this.plugin.ck2idDict);
  }

  private getPort(type: ZoteroType): "23119" | "24119" {
    return type === "Zotero" ? "23119" : "24119";
  }

  private getCitekeysFromZotero(items: any[]): string[] {
    if (!items) return [];
    
    const citekeys = items.map((item: any) => {
      if (!item.citekey && !item.citationKey) return null;
      return item.citekey || item.citationKey;
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