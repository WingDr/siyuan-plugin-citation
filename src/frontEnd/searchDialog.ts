import {
  Dialog
} from "siyuan";
import SiYuanPluginCitation from "../index";
import { ILogger, createLogger } from "../utils/simple-logger";
import { isDev } from "../utils/constants";

export interface SearchRes {
  item: {
    id: string
  },
  itemContent: {
    title: string,
    year: string,
    authorString: string
  },
  matches: Match[]
}

export interface Match {
  value: string,
  indices: number[][]
}


export class SearchDialog {
  private searchDialog: Dialog;
  private logger: ILogger;
  private resList: SearchRes[];
  private selector: number;
  private onSelection: (citekeys: string[]) => void;

  constructor (public plugin: SiYuanPluginCitation) {
    this.logger = createLogger("search dialog");
  }

  public showSearching(search: (pattern: string) => any, onSelection: (citekeys: string[]) => void) {
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
      const searchRes = search(input.value);
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
   * Construct the shown results
   * @param resList the searching result list
   * @returns HTMLElement of the result table
   */
  private resultTableConstructor(resList: SearchRes[]): HTMLUListElement {
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

  private matchHighlight(match: Match) {
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
    this.onSelection([id]);
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
      this.onSelection([id]);
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

}