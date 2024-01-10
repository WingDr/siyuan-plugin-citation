import {
  Setting,
  Protyle,
  Menu,
  type IMenuItemOption
} from "siyuan";
import SiYuanPluginCitation from "../index";
import {
  STORAGE_NAME,
  isDev,
  pluginIconSVG
} from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { type DatabaseType } from "../database/database";
import { EventTrigger } from "../eventManager/eventTrigger";
import { SettingTab } from "./settingTab/settingTab";

interface ICommandSetting {
  supportDatabase?: DatabaseType[];
  langKey: string, // 用于区分不同快捷键的 key
  langText?: string, // 快捷键功能描述文本
  /**
   * 目前需使用 MacOS 符号标识，顺序按照 ⌥⇧⌘，入 ⌥⇧⌘A
   * "Ctrl": "⌘",
   * "Shift": "⇧",
   * "Alt": "⌥",
   * "Tab": "⇥",
   * "Backspace": "⌫",
   * "Delete": "⌦",
   * "Enter": "↩",
   */
  hotkey: string,
  customHotkey?: string,
  callback?: () => void
  fileTreeCallback?: (file: any) => void
  editorCallback?: (protyle: any) => void
  dockCallback?: (element: HTMLElement) => void
}

type MenuPlace = "TitleIcon" | "BlockIcon" | "BreadcrumbMore";

interface IMenuItemSetting {
  place?: MenuPlace[],
  check?: (id: string) => boolean,
  clickCallback?: (id: string) => void,
  label?: string,
  click?: (element: HTMLElement) => void,
  type?: "separator" | "submenu" | "readonly",
  accelerator?: string,
  action?: string,
  id?: string,
  submenu?: IMenuItemOption[]
  disabled?: boolean
  icon?: string
  iconHTML?: string
  current?: boolean
  bind?: (element: HTMLElement) => void
  index?: number
  element?: HTMLElement
}

export class InteractionManager {
  public plugin: SiYuanPluginCitation;
  public setting: Setting;
  private logger: ILogger;
  private protyleSlashs: any[];
  private commands:ICommandSetting[];
  private menuItems: IMenuItemSetting[];

  constructor (plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.logger = createLogger("interaction manager");
    this.plugin.eventTrigger = new EventTrigger(plugin);
    this.protyleSlashs = [
      {
        filter: [this.plugin.i18n.addCitation, "插入文献引用", "addcitation", "cite", "charuwenxianyinyong"],
        html: `<div class = "b3-list-item__first">
          <svg class="b3-list-item__graphic">
            <use xlink:href="#iconRef"></use>
          </svg>
          <span class="b3-list-item__text">${this.plugin.i18n.addCitation}</span>
        </div>`,
        id: "add-citation",
        callback: async (protyle: Protyle) => {
          return this.plugin.database.insertCiteLink(protyle);
        }
      },
      {
        filter: [this.plugin.i18n.addNotes, "插入文献笔记", "addnotesofliterature", "charuwenxianbiji"],
        html: `<div class = "b3-list-item__first">
          <svg class="b3-list-item__graphic">
            <use xlink:href="#iconRef"></use>
          </svg>
          <span class="b3-list-item__text">${this.plugin.i18n.addNotes}</span>
        </div>`,
        id: "add-notes",
        callback: async (protyle: Protyle) => {
          return this.plugin.database.insertNotes(protyle);
        }
      },
      {
        filter: [this.plugin.i18n.addSelectedItems, "引用Zotero中选中的条目", "addzoteroselecteditemscitations", "yinyongzoterozhongxuanzhongdetiaomu"],
        html: `<div class = "b3-list-item__first">
          <svg class="b3-list-item__graphic">
            <use xlink:href="#iconRef"></use>
          </svg>
          <span class="b3-list-item__text">${this.plugin.i18n.addSelectedItems}</span>
        </div>`,
        id: "add-selected-items",
        callback: async (protyle: Protyle) => {
          return this.plugin.database.insertSelectedCiteLink(protyle);
        },
        supportDatabase: ["Juris-M (debug-bridge)", "Zotero (debug-bridge)"],
      }
    ];
    this.commands = [
      {
        langKey: "addCitation",
        hotkey: "⌥⇧A",
        editorCallback: (p) => {
          const protyle = p.getInstance();
          this.plugin.database.insertCiteLink(protyle);
        },
        callback: () => { return this.plugin.database.copyCiteLink(); }
      },
      {
        langKey: "addNotes",
        hotkey: "",
        editorCallback: (p) => {
          const protyle = p.getInstance();
          this.plugin.database.insertNotes(protyle);
        },
        callback: () => { return this.plugin.database.copyNotes(); }
      },
      {
        langKey: "reloadDatabase",
        hotkey: "",
        callback: async () => {
          await this.plugin.reference.checkRefDirExist();
          return this.plugin.database.buildDatabase(this.plugin.data[STORAGE_NAME].database as DatabaseType);
        }
      },
      {
        langKey: "refreshSingleLiteratureNote",
        hotkey: "",
        editorCallback: (p) => {
          const id = p.block.rootID;
          this.plugin.reference.refreshSingleLiteratureNote(id);
        }
      },
      {
        langKey: "refreshLiteratureNotesContents",
        hotkey: "",
        callback: async () => {
          return this.plugin.reference.refreshLiteratureNoteContents();
        }
      },
      {
        supportDatabase: ["Juris-M (debug-bridge)", "Zotero (debug-bridge)"],
        langKey: "addSelectedItems",
        hotkey: "",
        callback: () => { return this.plugin.database.copySelectedCiteLink();},
        editorCallback: (p) => {
          const protyle = p.getInstance();
          this.plugin.database.insertSelectedCiteLink(protyle);
        }
      }
    ];
    this.menuItems = [
      {
        place: ["BreadcrumbMore"],
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: this.plugin.i18n.menuItems.refreshCitation,
        clickCallback: (id) => {this.plugin.reference.updateLiteratureLink.bind(this.plugin.reference)(id);}
      },
      {
        place: ["BreadcrumbMore"],
        check: this.isLiteratureNote.bind(this),
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: this.plugin.i18n.menuItems.refreshSingleLiteratureNote,
        clickCallback: (id) => {this.plugin.reference.refreshSingleLiteratureNote(id);}
      },
      // {
      //   place: ["BreadcrumbMore"],
      //   iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconUpload"></use></svg>',
      //   label: "导出",
      //   clickCallback: (id) => {this.plugin.exportManager.export([id], "markdown");}
      // }
    ];
  }

  /**
   * Custom the setting tab with the functions below:
   * 
   * - Select which notebook should the references storaged
   * - Input the storage path of the references
   * @returns Setting object
   */
  public async customSettingTab() {
    return new SettingTab(this.plugin);
  }

  public async customProtyleSlash() {
    return this.protyleSlashs.reduce((acc, ps) => {
      if (this.validateCommand(ps)) {
        return [...acc, {
          filter: ps.filter,
          html: ps.html,
          id: ps.id,
          callback: (protyle: Protyle) => {
            if (isDev) this.logger.info(`Slash触发：${ps.id}, protyle=>`, protyle);
            if (this.validateCommand(ps)) ps.callback(protyle);
            else if (isDev) this.logger.error("Slash调用不合法：, id=>", ps.id);
          }
        }];
      } else return acc;
    }, []);
  }

  public async customCommand() {
    this.commands.forEach(command => {
      if (this.validateCommand(command)) {
        this.plugin.addCommand({
          langKey: command.langKey,
          hotkey: command.hotkey,
          callback: () => {
            if (isDev) this.logger.info(`Command触发：${command.langKey}，callback`);
            if (command.callback && this.validateCommand(command)) command.callback();
            else if (isDev) this.logger.error(`Command调用不合法：${command.langKey}`);
          },
          editorCallback: (p) => {
            if (isDev) this.logger.info(`Command触发：${command.langKey}，editorCallback`);
            if (command.editorCallback && this.validateCommand(command)) command.editorCallback(p);
            else if (command.callback && this.validateCommand(command)) command.callback();
            else if (isDev) this.logger.error(`Command调用不合法：${command.langKey}`);
          },
          dockCallback: (e) => {
            if (isDev) this.logger.info(`Command触发：${command.langKey}，dockCallback`);
            if (command.dockCallback && this.validateCommand(command)) command.dockCallback(e);
            else if (command.callback && this.validateCommand(command)) command.callback();
            else if (isDev) this.logger.error(`Command调用不合法：${command.langKey}`);
          },
          fileTreeCallback: (file) => {
            if (isDev) this.logger.info(`Command触发：${command.langKey}，fileTreeCallback`);
            if (command.fileTreeCallback && this.validateCommand(command)) command.fileTreeCallback(file);
            else if (command.callback && this.validateCommand(command)) command.callback();
            else if (isDev) this.logger.error(`Command调用不合法：${command.langKey}`);
          }
        });
      }
    });
  }

  private validateCommand(command: {supportDatabase?: DatabaseType[number][]}): boolean {
    const database = this.plugin.data[STORAGE_NAME].database;
    if (!command.supportDatabase || command.supportDatabase.indexOf(database) != -1) return true;
    return false;
  }

  public eventBusReaction() {
    // this.plugin.eventTrigger.addEventBusEvent("click-editortitleicon", this.customTitleIconMenu.bind(this));
    this.plugin.eventTrigger.addEventBusEvent("open-menu-breadcrumbmore", this.customBreadcrumbMore.bind(this));
    this.plugin.eventTrigger.addEvent("transactions", {
      type: "repeated",
      params: {},
      triggerFn: this.hookTransactions.bind(this)
    });
  }

  private async hookTransactions(params: {event: CustomEvent<any>}) {
    const detail = params.event.detail.data[0].doOperations[0];
    const autoReplace = this.plugin.data[STORAGE_NAME].autoReplace;
    // 拖过来的时候只会产生uodate事件
    if (autoReplace && detail.action == "update") {
      let id = detail.id;
      const data = detail.data as string;
      const selection = window.getSelection();
      let insertedNode = document.querySelector(`div[data-node-id="${id}"]`);
      // 不管是拖进来还是复制的，光标应该都在原位
      if (selection.anchorNode.parentElement && (this.getNode(selection.anchorNode.parentElement)?.getAttribute("data-node-id") != id)) {
        if (isDev) this.logger.info("触发位置不为光标位置, detail=>", {selection, detail});
        return;
      }
      const zoteroURLReg = /data-href=\"zotero:\/\/select\/library\/items\/(.*?)\"/;
      const zoteroURLMatch = data.match(zoteroURLReg);
      // 在data里面找到zotero链接才是zotero传过来的
      if (insertedNode && zoteroURLMatch && zoteroURLMatch.length) {
        const itemKey = zoteroURLMatch[1];
        const key = "1_" + itemKey;
        const linkNode = insertedNode.querySelector(`span[data-href="zotero://select/library/items/${itemKey}"]`);
        // 事件会执行两次，但是其实只需要替换一次
        if (linkNode && linkNode.parentNode) {
          if (isDev) this.logger.info("确认到从Zotero拖拽事件, itemKey=>", {itemKey});
          const content = await this.plugin.reference.processReferenceContents([key], null, true, false);
          if (!content[0]) return;
          if (isDev) this.logger.info("获取到插入内容, content=>", {content:content[0]});
          // const noteContent = (await this.plugin.kernelApi.getBlock(id)).data[0].markdown as string;
          // const insertContent = noteContent.replace(/\([(.*?)]\(zotero:\/\/select\/library\/items\/(.*?)\)\)/, content[0]);
          // await this.plugin.kernelApi.updateBlockContent(id, "markdown", insertContent);
          const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
          const insertHTML = `<span data-type="block-ref" data-subtype="${useDynamicRefLink ? "d" : "s"}" data-id="${content[0].citeId}">${content[0].content}</span>`;
          const newRefNode = (new DOMParser()).parseFromString(insertHTML, "text/html").querySelector(`span[data-id="${content[0].citeId}"]`);
          linkNode.parentNode.replaceChild(newRefNode, linkNode);
          insertedNode = this.getNode(newRefNode as HTMLElement);
          if (isDev) this.logger.info("获取到链接和包含链接的最小节点, node=>", {newRefNode, insertedNode});
          id = insertedNode.getAttribute("data-node-id");
          const updateHTML = insertedNode.children.item(0);
          await this.plugin.kernelApi.updateBlockContent(id, "dom", updateHTML.innerHTML);
          if (isDev) this.logger.info("从Zotero拖拽/粘贴事件处理完成");
        }
      }
    }
  }

  private customTitleIconMenu(event: CustomEvent<any>) {
    if (isDev) this.logger.info("触发eventBus：click-editortitleicon，=>", event);

    (event.detail.menu as Menu).addItem({
      iconHTML: '<div class="b3-menu__icon" style><svg xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="0 0 160 160"><path d="M71.9 27c-13 2.2-30.2 14.6-34.8 25.2-5.9 13.4-7.5 20.5-6.7 29.8 2 22.2 11.7 36.9 30.5 46.2 7.7 3.8 15.1 5.2 25.1 4.5 9.3-.7 18.4-3.4 24.2-7.2 4.2-2.8 12.8-11.1 12.8-12.4 0-.9-14.5-10.1-16-10.1-.5 0-3 1.5-5.5 3.4-8.3 6.4-19.6 7.9-31.6 4.4-3-.9-4.8-.7-10.2 1.1-7.3 2.3-11.7 2.7-11.7 1 0-.6 1.2-5 2.6-9.7 2.4-7.8 2.5-8.8 1.3-12.6-1.6-4.7-1.5-20.4.1-22 .5-.5 1-1.8 1-2.7 0-2.7 10.5-13.5 15.3-15.8 5.9-2.8 14.8-4 20.5-2.8 4.5.9 14.6 5.9 15.8 7.8.3.5 1.1.9 1.8.9 1.4 0 14.1-7.1 15.9-8.9.6-.6-.8-2.9-3.9-6.5-5.3-6-15-11.6-23.4-13.5-5.2-1.2-16.3-1.2-23.1-.1z"/></svg></div>',
      label: "文献引用",
      submenu: [{
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: this.plugin.i18n.menuItems.refreshCitation,
        click: () => {this.plugin.reference.updateLiteratureLink.bind(this.plugin.reference)(event.detail.data.id);}
      },
      // {
      //   iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconUpload"></use></svg>',
      //   label: "导出",
      //   click: () => {this.plugin.exportManager.setExportConfig();}
      // }
      ]
    });
  }

  private customBreadcrumbMore(event: CustomEvent<any>) {
    if (isDev) this.logger.info("触发eventBus：open-menu-breadcrumbmore，=>", event);
    const place = "BreadcrumbMore" as MenuPlace;
    // const submenu = [] as IMenuItemOption[];
    const id  = event.detail.protyle.block.rootID;
    this.menuItems.forEach(item => {
      if (!item.place || item.place.indexOf(place) != -1) {
        if (!item.check || item.check(id)) {
          (event.detail.menu as Menu).addItem({
            iconHTML: item.iconHTML,
            label: this.plugin.i18n.prefix + item.label,
            click: () => {item.clickCallback(id);}
          });
        }
      }
    });
    // (event.detail.menu as Menu).addItem({
    //   iconHTML: `<div class="b3-menu__icon" style>${pluginIconSVG}</div>`,
    //   label: ,
    //   submenu: submenu
    // });
  }

  private isLiteratureNote(documentId: string): boolean {
    return this.plugin.literaturePool.get(documentId) ? true : false;
  }

  private getNode(node:HTMLElement) {
    let nowNode = node;
    if (!nowNode) return null;
    while (!nowNode.getAttribute("data-node-id")) {
      nowNode = nowNode.parentElement;
      if (!nowNode) return null;
    }
    return nowNode;
  }
}