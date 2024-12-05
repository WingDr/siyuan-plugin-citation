import {
  Dialog
} from "siyuan";
import SiYuanPluginCitation from "../../index";
import { type ILogger, createLogger } from "../../utils/simple-logger";
import { isDev } from "../../utils/constants";
import SearchDialogComponent from "./dialogComponent.svelte";
import { mount, unmount } from "svelte";

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
  private searchDialog!: Dialog;
  private logger: ILogger;

  constructor (public plugin: SiYuanPluginCitation) {
    this.logger = createLogger("search dialog");
  }

  public showSearching(
    search: (pattern: string) => any, 
    onSelection: (keys: string[]) => void, 
    selectedList: {key: string, author: string, year: string}[] = []
  ) {
    if (isDev) this.logger.info("打开搜索界面");

    const id = `dialog-search-${Date.now()}`;
    this.searchDialog = new Dialog({
      content: `<div id="${id}" class="b3-dialog__body"/>`,
      width: this.plugin.isMobile ? "92vw" : "640px",
      height: "40vh",
      destroyCallback(){if (component) unmount(component)}
    });

    const component = mount(SearchDialogComponent, {
      target: this.searchDialog.element.querySelector(`#${id}`)!,
      props: {
        onSelection,
        search,
        selectedList,
        refresh: () => {
          const table = this.searchDialog.element.getElementsByTagName("ul").item(0)!;
          table.scrollTop = 0;
        },
        confirm: () => {
          if (isDev) this.logger.info("关闭搜索界面");
          return this.searchDialog.destroy();
        },
        select: (selector: number) => {
          const focusElement = this.searchDialog.element.getElementsByTagName("li").item(selector)!;
          focusElement.scrollIntoView({behavior: "smooth", block: "center"});
        }
      }
    })

    // const component = new SearchDialogComponent({
    //   target: this.searchDialog.element.querySelector(`#${id}`),
    //   props: {
    //     onSelection,
    //     search,
    //     selectedList
    //   }
    // });

    this.searchDialog.element.querySelector(".b3-dialog__header")!.className = "resize__move b3-dialog__header fn__none-custom";
    const input = this.searchDialog.element.querySelector("#pattern-input") as HTMLInputElement;
    input.focus();

    // component.$on("refresh", () => {
    //   const table = this.searchDialog.element.getElementsByTagName("ul").item(0);
    //   table.scrollTop = 0;
    // });

    // component.$on("select", e => {
    //   const selector = e.detail.selector;
    //   const focusElement = this.searchDialog.element.getElementsByTagName("li").item(selector);
    //   focusElement.scrollIntoView({behavior: "smooth", block: "center"});
    // });

    // component.$on("confirm", ()=> {
    //   if (isDev) this.logger.info("关闭搜索界面");
    //   return this.searchDialog.destroy();
    // });
  }
}