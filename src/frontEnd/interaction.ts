import {
  Setting,
  Protyle,
  Menu
} from "siyuan";
import SiYuanPluginCitation from "../index";
import {
  STORAGE_NAME,
  isDev
} from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { type DatabaseType } from "../database/database";
import { EventTrigger } from "./eventTrigger";
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

export class InteractionManager {
  public plugin: SiYuanPluginCitation;
  public setting: Setting;
  private logger: ILogger;

  constructor (plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.logger = createLogger("interaction manager");
    this.plugin.eventTrigger = new EventTrigger(plugin);
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
    return [{
      filter: [this.plugin.i18n.addCitation, "插入文献引用", "addcitation", "charuwenxianyinyong"],
      html: `<div class = "b3-list-item__first">
        <svg class="b3-list-item__graphic">
          <use xlink:href="#iconRef"></use>
        </svg>
        <span class="b3-list-item__text">${this.plugin.i18n.addCitation}</span>
      </div>`,
      id: "add-literature-citation",
      callback: async (protyle: Protyle) => {
        if (isDev) this.logger.info("Slash触发：add literature citation", protyle);
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
      id: "add-literature-notes",
      callback: async (protyle: Protyle) => {
        if (isDev) this.logger.info("Slash触发：add literature citation", protyle);
        return this.plugin.database.insertNotes(protyle);
      }
    }];
  }

  private commands:ICommandSetting[] = [
    {
      langKey: "addCitation",
      hotkey: "⌥⇧A",
      editorCallback: (p) => {
        const protyle = p.getInstance();
        this.plugin.database.insertCiteLink(protyle);
      }
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
      langKey: "refreshLiteratureNotesTitle",
      hotkey: "",
      callback: () => { return this.plugin.reference.refreshLiteratureNoteTitles(); }
    },
    {
      langKey: "copyCiteLink",
      hotkey: "",
      callback: () => { return this.plugin.database.copyCiteLink(); }
    },
    {
      langKey: "copyNotes",
      hotkey: "",
      callback: () => { return this.plugin.database.copyNotes(); }
    },
    {
      supportDatabase: ["Juris-M (debug-bridge)", "Zotero (debug-bridge)"],
      langKey: "addSelectedItems",
      hotkey: "",
      callback: () => { return ;}
    }
  ];

  public async customCommand() {
    this.commands.forEach(command => {
      if (this.validateCommand(command)) {
        this.plugin.addCommand({
          langKey: command.langKey,
          hotkey: command.hotkey,
          callback: () => {
            if (isDev) this.logger.info(`Command触发：${command.langKey}`);
            if (command.callback && this.validateCommand(command)) command.callback();
            else if (isDev) this.logger.error(`Command调用不合法：${command.langKey}`);
          },
          editorCallback: (p) => {
            if (isDev) this.logger.info(`Command触发：${command.langKey}`);
            if (command.editorCallback && this.validateCommand(command)) command.editorCallback(p);
            else if (isDev) this.logger.error(`Command调用不合法：${command.langKey}`);
          }
        });
      }
    });
  }

  private validateCommand(command: ICommandSetting): boolean {
    const database = this.plugin.data[STORAGE_NAME].database;
    if (!command.supportDatabase || command.supportDatabase.indexOf(database) != -1) return true;
    return false;
  }

  public eventBusReaction() {
    this.plugin.eventTrigger.addEventBusEvent("click-editortitleicon", this.customTitleIconMenu.bind(this));
    this.plugin.eventTrigger.addEventBusEvent("open-menu-breadcrumbmore", this.customBreadcrumbMore.bind(this));
  }

  private customTitleIconMenu(event: CustomEvent<any>) {
    if (isDev) this.logger.info("触发eventBus：click-editortitleicon，=>", event);
    const label = this.plugin.i18n.refreshCitation;
    const clickCallback = this.plugin.reference.updateLiteratureLink.bind(this.plugin.reference);
    (event.detail.menu as Menu).addItem({
      iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
      label: label,
      click: () => {clickCallback(event.detail.data.id);}
    });
  }

  private customBreadcrumbMore(event: CustomEvent<any>) {
    if (isDev) this.logger.info("触发eventBus：open-menu-breadcrumbmore，=>", event);
    // 刷新引用
    event.detail.menu.addItem({
      iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
      label: this.plugin.i18n.refreshCitation,
      click: () => {
        if (isDev) this.logger.info("按键触发：刷新引用，=>", event);
        this.plugin.reference.updateLiteratureLink(event.detail.protyle.block.rootID);
      }
    });
  }
}