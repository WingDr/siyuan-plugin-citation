import {
  Setting,
  Protyle,
  Menu,
  openTab
} from "siyuan";
import { type IMenu, subMenu } from "siyuan";
import SiYuanPluginCitation from "../index";
import {
  STORAGE_NAME,
  isDev
} from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { type DatabaseType } from "../database/database";
import { EventTrigger } from "../events/eventTrigger";
import { SettingTab } from "./settingTab/settingTab";
import { exportTypes, type ExportType } from "../export/exportManager";

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

type MenuPlace = "TitleIcon" | "BlockIcon" | "BreadcrumbMore" | "BlockRef" | "DocTree";

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
  submenu?: IMenu[],
  generateSubMenu?: (option: any) => IMenu[],
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
          const res = this.plugin.reference.getAllNeighborReference(protyle.protyle);
          this.plugin.database.setSelected(res.keyList);
          this.plugin.database.setRefNode(res.refStartNode, res.refEndNode);
          return this.plugin.database.insertCiteLink(protyle);
        }
      },
      // {
      //   filter: ["test"],
      //   html: `<div class = "b3-list-item__first">
      //     <svg class="b3-list-item__graphic">
      //       <use xlink:href="#iconRef"></use>
      //     </svg>
      //     <span class="b3-list-item__text">测试</span>
      //   </div>`,
      //   id: "test",
      //   callback: async (protyle: Protyle) => {
      //     return this.plugin.reference.getAllNeighborReference(protyle.protyle);
      //   }
      // },
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
          this.plugin.database.setSelected([]);
          this.plugin.reference.setEmptySelection();
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
          this.plugin.database.setSelected([]);
          this.plugin.reference.setEmptySelection();
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
          const protyle = p.getInstance() as Protyle;
          const res = this.plugin.reference.getAllNeighborReference(protyle.protyle);
          this.plugin.database.setSelected(res.keyList);
          this.plugin.database.setRefNode(res.refStartNode, res.refEndNode);
          this.plugin.database.insertCiteLink(protyle);
        },
        callback: () => { return this.plugin.database.copyCiteLink(); }
      },
      {
        langKey: "addNotes",
        hotkey: "",
        editorCallback: (p) => {
          const protyle = p.getInstance() as Protyle;
          this.plugin.database.setSelected([]);
          this.plugin.reference.setEmptySelection();
          this.plugin.database.insertNotes(protyle);
        },
        callback: () => { return this.plugin.database.copyNotes(); }
      },
      {
        supportDatabase: ["Juris-M (debug-bridge)", "Zotero (debug-bridge)"],
        langKey: "addSelectedItems",
        hotkey: "",
        callback: () => { return this.plugin.database.copySelectedCiteLink();},
        editorCallback: (p) => {
          const protyle = p.getInstance() as Protyle;
          this.plugin.database.setSelected([]);
          this.plugin.reference.setEmptySelection();
          this.plugin.database.insertSelectedCiteLink(protyle);
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
        langKey: "checkUnlinkedLiterature",
        hotkey: "",
        callback: async () => {
          return this.plugin.reference.checkUnlinkedLiteratures();
        }
      }
      // {
      //   langKey: "test",
      //   hotkey: "",
      //   callback: async () => {
      //   }
      // },
    ];
    this.menuItems = [
      {
        place: ["BreadcrumbMore", "TitleIcon"],
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).refreshCitation,
        clickCallback: (id) => {this.plugin.reference.updateLiteratureLink.bind(this.plugin.reference)(id);}
      },
      {
        // 刷新标题
        place: ["BreadcrumbMore", "TitleIcon"],
        check: this.isLiteratureNote.bind(this),
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).refreshSingleLiteratureNoteTitle,
        clickCallback: (id) => {this.plugin.reference.refreshSingleLiteratureNoteTitles(id);}
      },
      {
        place: ["BreadcrumbMore", "TitleIcon"],
        check: this.isLiteratureNote.bind(this),
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).refreshSingleLiteratureNote,
        clickCallback: (id) => {this.plugin.reference.refreshSingleLiteratureNote(id);}
      },
      {
        place: ["BreadcrumbMore", "TitleIcon"],
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconUpload"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).export,
        // clickCallback: (id) => {this.plugin.exportManager.export(id, "markdown");},
        generateSubMenu: this.generateExportMenu.bind(this)
      },
      {
        // 绑定文档到文献
        place: ["BreadcrumbMore", "TitleIcon"],
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconLink"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).bindToLiterature,
        // clickCallback: (id) => {this.plugin.exportManager.export(id, "markdown");},
        clickCallback: (id) => {
          this.plugin.database.setSelected([]);
          this.plugin.reference.setEmptySelection();
          this.plugin.database.linkDocToLiterature(id);
        }
      },
      {
        // 与文献解锁绑定
        place: ["BreadcrumbMore", "TitleIcon"],
        check: this.isLiteratureNote.bind(this),
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconTrashcan"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).unbindFromLiterature,
        // clickCallback: (id) => {this.plugin.exportManager.export(id, "markdown");},
        clickCallback: (id) => {this.plugin.reference.unbindDocumentFromLiterature(id);}
      },
      {
        place: ["BlockRef"],
        iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconRefresh"></use></svg>',
        label: (this.plugin.i18n.menuItems as any).turnTo,
        generateSubMenu: this.generateChangeCiteMenu.bind(this)
      },
      // {
      //   place: ["DocTree"],
      //   check: this.isLiteratureNote.bind(this),
      //   iconHTML: '<svg class="b3-menu__icon" style><use xlink:href="#iconScrollHoriz"></use></svg>',
      //   label: (this.plugin.i18n.menuItems as any).refreshSingleLiteratureNote,
      //   clickCallback: (id) => {this.plugin.reference.refreshSingleLiteratureNote(id);}
      // },
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
          customHotkey: "",
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
    this.plugin.eventTrigger.addEventBusEvent("click-editortitleicon", this.customTitleIconMenu.bind(this));
    this.plugin.eventTrigger.addEventBusEvent("open-menu-blockref", this.customBlockRefMenu.bind(this));
    this.plugin.eventTrigger.addEventBusEvent("paste", this.hookPaste.bind(this));
    this.plugin.eventTrigger.addEventBusEvent("open-siyuan-url-plugin", this.openURLPlugin.bind(this));
    // this.plugin.eventTrigger.addEventBusEvent("open-menu-doctree", this.customdocTreeMenu.bind(this));
    // this.plugin.eventTrigger.addEventBusEvent("open-menu-breadcrumbmore", this.customBreadcrumbMore.bind(this));
    // this.plugin.eventTrigger.addEvent("transactions", {
    //   type: "repeated",
    //   params: {},
    //   triggerFn: this.hookTransactions.bind(this)
    // });
  }

  private async hookPaste(event: CustomEvent) {
    if (isDev) this.logger.info("触发粘贴事件：ev=>", event);
    if (["Zotero (debug-bridge)", "Juris-M (debug-bridge)"].indexOf(this.plugin.database.type!) == -1) {
      // 不支持除使用debug-bridge以外的方法（因为要从itemkey开始查询）
      if (isDev) this.logger.info("数据库格式不支持，type=>",{type: this.plugin.database.type});
      return null;
    }
    // 在粘贴过来的东西中，需要处理引用和图片
    const autoReplace = this.plugin.data[STORAGE_NAME].autoReplace as boolean;
    // 该设置项暂时由autoreplace承担
    const autoMoveImage = this.plugin.data[STORAGE_NAME].autoReplace as boolean;
    const detail = event.detail;
    let resHTML = detail.textHTML as string;

    const zoteroURLReg = /<span class=\"citation\">\(<a href=\"zotero:\/\/select\/library\/items\/(.*?)\">.*?<\/a>\)<\/span>/;
    if (!zoteroURLReg.test(resHTML)) {
      // 不包含这种链接就不处理，包括处理图片也需要这个的
      return;
    }
    let citeDetail = null;
    if (autoReplace) {
      event.preventDefault();
      const zoteroURLMatch = resHTML.match(zoteroURLReg);
      const itemKey = zoteroURLMatch![1];
      const key = "1_" + itemKey;
      if (isDev) this.logger.info("确认到从Zotero拖拽事件, itemKey=>", {itemKey});
      const content = await this.plugin.reference.processReferenceContents([key], "", "", true, false);
      if (!content[0]) return;
      citeDetail = content[0];
      if (isDev) this.logger.info("获取到插入内容, content=>", {citeDetail});
      const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
      const insertHTML = `<span data-type="block-ref" data-subtype="${useDynamicRefLink ? "d" : "s"}" data-id="${content[0].citeId}">${content[0].content}</span>`;
      resHTML = resHTML.replace(zoteroURLReg, insertHTML);
    }
    const zoteroImageReg = /<img .*?>/;
    const zoteroAnnotationReg = /<a href="zotero:\/\/open-pdf\/library\/items\/(.*?)\?.*?annotation=(.*?)\".*<\/a>/;
    if (autoMoveImage && zoteroImageReg.test(resHTML) && zoteroAnnotationReg.test(resHTML)) {
      event.preventDefault();
      // 自动移动并且有图片部分和annotation的标识
      const zoteroAnnotationMatch = resHTML.match(zoteroAnnotationReg);
      if (!citeDetail) {
        // 如果之前没插入就插入一遍
        const zoteroURLMatch = resHTML.match(zoteroURLReg);
        const itemKey = zoteroURLMatch![1];
        const key = "1_" + itemKey;
        const content = await this.plugin.reference.processReferenceContents([key], "", "", true, false);
        if (!content[0]) return;
        citeDetail = content[0];
        if (isDev) this.logger.info("获取到插入内容, content=>", {citeDetail});
      }
      let resLink = "";
      const annoKey = zoteroAnnotationMatch![2];
      citeDetail.entry.annotationList.forEach((anno: { details: any[]; }) => {
        if (resLink.length) return;
        anno.details.forEach((detail: { key: string; dateAdded: string; annotationType: any; parentKey: any; }) => {
          if (resLink.length) return;
          if (detail.key == annoKey) {
            const time = detail.dateAdded.replace(/[-:\s]/g, "");
            // 用于欺骗思源的随机（伪）字符串，是7位的小写字母和数字（itemKey是8位）
            const randomStr = (detail.key as string).toLowerCase().slice(1);
            const name = `zotero-annotations-${detail.annotationType}-${detail.parentKey}-${detail.key}-${time}-${randomStr}`;
            const assetPath = `assets/${name}.png`;
            resLink = `<img src="${assetPath}" data-src="${assetPath}" alt="img">`;
          }
        });
      });
      resHTML = resHTML.replace(zoteroImageReg, resLink);
    }
    if (isDev) this.logger.info("替换插入内容，text=>", {resHTML});
    event.detail.resolve({
      textHTML: resHTML
    });
  }

  private async openURLPlugin(e: CustomEvent) {
    if (isDev) this.logger.info("从外部打开思源链接：", e);
    if (["Zotero (debug-bridge)", "Juris-M (debug-bridge)"].indexOf(this.plugin.database.type!) == -1) {
      // 不支持除使用debug-bridge以外的方法（因为要从itemkey开始查询）
      if (isDev) this.logger.info("数据库格式不支持，type=>",{type: this.plugin.database.type});
      return null;
    }
    const urlObj = new URL(e.detail.url);
    const pathname = urlObj.pathname;
    const subpaths = pathname.split("/");
    const func = subpaths[subpaths.length-1];
    if (func == "open-ref") {
      const params = new URLSearchParams(urlObj.search);
      const itemKey = params.get("key");
      if (isDev) this.logger.info("获取到链接参数：", {itemKey});
      if (this.plugin.literaturePool.get("1_" + itemKey)) {
        // 说明这个文档还没有被进行转换
        const docID = this.plugin.literaturePool.get("1_" + itemKey);
        if (isDev) this.logger.info("打开文档：", {docID});
        openTab({
          app: this.plugin.app,
          doc: {id: docID}
        });
      } else {
        // 找不到的话再往citekey里面找一找，再找不到就算了
        const item = await this.plugin.database.getContentByKey("1_" + itemKey);
        const citekey = item.citekey;
        const docID = this.plugin.literaturePool.get(citekey);
        if (!docID) {
          if (isDev) this.logger.info("找不到文献内容文档");
          return;
        }
        if (isDev) this.logger.info("打开文档：", {docID});
        openTab({
          app: this.plugin.app,
          doc: {id: docID}
        });
      }
    }
  }

  private customTitleIconMenu(event: CustomEvent<any>) {
    if (isDev) this.logger.info("触发eventBus：click-editortitleicon，=>", event);

    const place = "TitleIcon" as MenuPlace;
    // const submenu = [] as IMenuItemOption[];
    const id  = event.detail.protyle.block.rootID;
    this.menuItems.forEach(item => {
      if (!item.place || item.place.indexOf(place) != -1) {
        if (!item.check || item.check(id)) {
          (event.detail.menu as Menu).addItem({
            iconHTML: item.iconHTML,
            label: this.plugin.i18n.prefix + item.label,
            click: () => {item.clickCallback!(id);},
            submenu: item.submenu ?? (item.generateSubMenu ? item.generateSubMenu(event.detail) : undefined)
          });
        }
      }
    });

    // (event.detail.menu as Menu).addItem({
    //   iconHTML: '<div class="b3-menu__icon" style><svg xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="0 0 160 160"><path d="M71.9 27c-13 2.2-30.2 14.6-34.8 25.2-5.9 13.4-7.5 20.5-6.7 29.8 2 22.2 11.7 36.9 30.5 46.2 7.7 3.8 15.1 5.2 25.1 4.5 9.3-.7 18.4-3.4 24.2-7.2 4.2-2.8 12.8-11.1 12.8-12.4 0-.9-14.5-10.1-16-10.1-.5 0-3 1.5-5.5 3.4-8.3 6.4-19.6 7.9-31.6 4.4-3-.9-4.8-.7-10.2 1.1-7.3 2.3-11.7 2.7-11.7 1 0-.6 1.2-5 2.6-9.7 2.4-7.8 2.5-8.8 1.3-12.6-1.6-4.7-1.5-20.4.1-22 .5-.5 1-1.8 1-2.7 0-2.7 10.5-13.5 15.3-15.8 5.9-2.8 14.8-4 20.5-2.8 4.5.9 14.6 5.9 15.8 7.8.3.5 1.1.9 1.8.9 1.4 0 14.1-7.1 15.9-8.9.6-.6-.8-2.9-3.9-6.5-5.3-6-15-11.6-23.4-13.5-5.2-1.2-16.3-1.2-23.1-.1z"/></svg></div>',
    //   label: "文献引用",
    //   submenu
    // });
  }

  private customBlockRefMenu(event: CustomEvent) {
    if (isDev) this.logger.info("触发eventBus：open-menu-blockref，=>", event);

    const place = "BlockRef" as MenuPlace;
    // const submenu = [] as IMenuItemOption[];
    const id  = event.detail.protyle.block.rootID;
    this.menuItems.forEach(item => {
      if (!item.place || item.place.indexOf(place) != -1) {
        if (!item.check || item.check(id)) {
          (event.detail.menu as subMenu).addItem({
            iconHTML: item.iconHTML,
            label: this.plugin.i18n.prefix + item.label,
            click: () => {item.clickCallback!(event.detail);},
            submenu: item.submenu ?? (item.generateSubMenu ? item.generateSubMenu(event.detail) : null)
          } as IMenu);
        }
      }
    });
  }

  private customdocTreeMenu(event: CustomEvent) {
    if (isDev) this.logger.info("触发eventBus：open-menu-doctree，=>", event);

    const place = "DocTree" as MenuPlace;
    // const submenu = [] as IMenuItemOption[];
    const id  = event.detail.protyle.block.rootID;
    this.menuItems.forEach(item => {
      if (!item.place || item.place.indexOf(place) != -1) {
        if (!item.check || item.check(id)) {
          (event.detail.menu as subMenu).addItem({
            iconHTML: item.iconHTML,
            label: this.plugin.i18n.prefix + item.label,
            click: () => {item.clickCallback!(event.detail);},
            submenu: item.submenu ?? (item.generateSubMenu ? item.generateSubMenu(event.detail) : null)
          } as IMenu);
        }
      }
    });
  }

  private generateExportMenu(detail: any): IMenu[] {
    const icons = ["iconMarkdown", "iconExact", "iconUpload"]
    return exportTypes.map((type: ExportType, index:number) => {
      return {
        label: type,
        icon: icons[index],
        id: type,
        click: () => {
          this.plugin.exportManager.export(detail.data.id, type)
        }
      } as IMenu;
    })
  }

  private generateChangeCiteMenu(detail: any): IMenu[] {
    return this.plugin.data[STORAGE_NAME].linkTemplatesGroup.map((set: { name: string; }) => {
      return {
        label: set.name,
        icon: "iconRefresh",
        id: set.name,
        click: () => {
          this.plugin.reference.updateNeighborLinks(detail.element, detail.protyle, set.name);
        }
      } as IMenu;
    });
  }

  private isLiteratureNote(documentId: string): boolean {
    return this.plugin.literaturePool.get(documentId) ? true : false;
  }

  // 下面都是暂时用不到的

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
            click: () => {item.clickCallback!(id);}
          });
        }
      }
    });
  }
}