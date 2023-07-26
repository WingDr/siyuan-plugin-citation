import {
  Dialog
} from "siyuan";
import SiYuanPluginCitation from "../../index";
import { type ILogger, createLogger } from "../../utils/simple-logger";
import { isDev } from "../../utils/constants";
import SearchDialogComponent from "./dialogComponent.svelte";

export interface SearchRes {
  item: {
    key: string
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
  private onSelection: (keys: string[]) => void;

  constructor (public plugin: SiYuanPluginCitation) {
    this.logger = createLogger("search dialog");
  }

  public showSearching(search: (pattern: string) => any, onSelection: (keys: string[]) => void) {
    this.onSelection = onSelection;
    if (isDev) this.logger.info("打开搜索界面");

    const id = `dialog-search-${Date.now()}`;
    this.searchDialog = new Dialog({
      content: `<div id="${id}" class="b3-dialog__body"/>`,
      width: this.plugin.isMobile ? "120vw" : "520px",
      height: "40vh",
      destroyCallback: () => {if (isDev) this.logger.info("关闭搜索界面");}
    });

    const component = new SearchDialogComponent({
      target: this.searchDialog.element.querySelector(`#${id}`),
      props: {
        onSelection,
        search
      }
    });

    this.searchDialog.element.querySelector(".b3-dialog__header").className = "resize__move b3-dialog__header fn__none-custom";
    const input = this.searchDialog.element.querySelector("#pattern-input") as HTMLInputElement;
    input.focus();

    component.$on("select", e => {
      const selector = e.detail.selector;
      const focusElement = this.searchDialog.element.getElementsByTagName("li").item(selector);
      focusElement.scrollIntoView({behavior: "smooth", block: "center"});
    });

    component.$on("confirm", ()=> {
      this.searchDialog.destroy();
    });
  }
}