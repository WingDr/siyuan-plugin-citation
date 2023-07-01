import Fuse from "fuse.js";

import {
  Dialog
} from "siyuan";
import SiYuanPluginCitation from "./index";
import { createLogger,ILogger } from "./utils/simple-logger";
import { isDev } from "./utils/constants";

// TODO 高亮匹配部分

class SearchModal {
  private fuse: any;
  private resList: any[];
  private searchDialog: Dialog;
  private selector: number;
  private logger: ILogger;
  public p: any;
  plugin: SiYuanPluginCitation;

  constructor(plugin: SiYuanPluginCitation) {
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
    this.plugin = plugin;
    this.logger = createLogger("search modal");
    this.fuse = new Fuse(this.plugin.library.entryList, options);
  }

  /**
   * show searching dialog
   */
  public showSearching(p) {
    this.p = p;
    const input = document.createElement("input");
    input.className = "b3-text-field b3-text-field--text fn-block";
    input.setAttribute("style", "width: 100%");
    input.placeholder = "Searching literature";
    if (isDev) this.logger.info("打开搜索界面");
    this.searchDialog = new Dialog({
        content: '<div class="plugin-citation__search-tab__input-container fn-block" id="input-container"></div><div class="search__layout" id="result-container"><ul></ul></div>',
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
        const item = this.plugin.library.getTemplateVariablesForCitekey(res.item.id);
        literatureContent.innerHTML = `<div class="b3-list-item__text" style="font-weight:bold"> ${item.title}</div> <div class="b3-list-item__text">${item.year} ${item.authorString}</div>`;
        singleRes.className = "b3-list-item";
        singleRes.appendChild(literatureContent);
        content.appendChild(singleRes);
        singleRes.addEventListener("click", (ev) => this.clickReaction(ev));
    });
    return content;
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

  /**
   * Self-determined function. Do anything with the selected citekey
   */
  public onSelection(citekey: string) {
    console.log(citekey);
  }
}

export class insertCiteLink extends SearchModal {
  public async onSelection(citekey: string) {
    const fileId = this.p.protyle.block.rootID;
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const literatureEnum = await this.plugin.reference.getLiteratureEnum(fileId);
      const existNotes = Object.keys(this.plugin.ck2idDict);
      const idx = existNotes.indexOf(citekey);
      await this.plugin.reference.updateLiteratureNote(citekey);
      const citeId = this.plugin.ck2idDict[citekey];
      let link = "";
      if (idx == -1) {
        link = this.plugin.reference.generateCiteLink(citekey, literatureEnum.length + 1);
      } else {
        link = this.plugin.reference.generateCiteLink(citekey, literatureEnum.length + 1);
      }
      this.plugin.reference.insertCiteLink(this.p, this.plugin.interactionManager.generateCiteRef(citeId, link));
    }
  }
}