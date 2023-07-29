import {
  Setting,
  showMessage,
  confirm,
  Protyle
} from "siyuan";
import SiYuanPluginCitation from "../index";
import {
  STORAGE_NAME,
  hiddenNotebook,
  databaseType,
  defaultTitleTemplate,
  defaultNoteTemplate,
  defaultLinkTemplate,
  defaultReferencePath,
  isDev,
  dataDir
} from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { type DatabaseType } from "../database/database";

export class InteractionManager {
  public plugin: SiYuanPluginCitation;
  public setting: Setting;
  private logger: ILogger;

  constructor (plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.logger = createLogger("interaction manager");
  }

  /**
   * Custom the setting tab with the functions below:
   * 
   * - Select which notebook should the references storaged
   * - Input the storage path of the references
   * @returns Setting object
   */
  public async customSettingTab(): Promise<Setting> {
    this.setting = new Setting({
        confirmCallback: () => {
          if (databaseSelector.value === "Zotero") databaseSelector.value = "Zotero (better-bibtex)";
          else if (databaseSelector.value === "Juris-M") databaseSelector.value = "Juris-M (better-bibtex)";
          const settingData = {
              referenceNotebook: referenceNotebookSelector.value,
              referencePath: referencePathInput.value,
              database: databaseSelector.value,
              titleTemplate: titleTemplateInput.value,
              noteTemplate: noteTempTexarea.value,
              linkTemplate: linkTempInput.value,
              customCiteText: CustomCiteTextSwitch.checked,
              useItemKey: UseItemKeySwitch.checked
          };
          let refreshDatabase = false;
          let refreshName = false;
          // 改变了笔记本和数据库类型之后都要刷新数据库
          if (settingData.referenceNotebook != this.plugin.data[STORAGE_NAME].referenceNotebook || settingData.database != this.plugin.data[STORAGE_NAME].database) refreshDatabase = true;
          if (UseItemKeySwitch.checked != this.plugin.data[STORAGE_NAME].useItemKey) refreshName = true;
          this.plugin.saveData(STORAGE_NAME, settingData).then(() => {
            if (refreshDatabase || refreshName) {
              this.plugin.reference.checkRefDirExist();
              this.plugin.database.buildDatabase(settingData.database as DatabaseType);
            }
            if (refreshName) this.plugin.noticer.info((this.plugin.i18n.notices.changeKey as string).replace("${keyType}", settingData.useItemKey ? "itemKey" : "citekey"));
          });
        }
    });

    const eMail = "siyuan_citation@126.com";
    const issuesURL = "https://github.com/WingDr/siyuan-plugin-citation/issues";
    const fs = window.require("fs");
    const path = window.require("path");
    const file = JSON.parse(await fs.readFileSync(path.join(dataDir, "./plugins/siyuan-plugin-citation/plugin.json")));
    this.setting.addItem({
      title: this.plugin.i18n.settingTab.settingTabTitle.replace("${version}", file.version),
      description: this.plugin.i18n.settingTab.settingTabDescription.replaceAll("${e-mail}", eMail).replace("${issuesURL}", issuesURL),
  });

    //notebook selector
    const referenceNotebookSelector = document.createElement("select");
    referenceNotebookSelector.className = "b3-select fn__flex-center fn__size200";
    referenceNotebookSelector.required = true;
    const notebooksRequest = await this.plugin.kernelApi.lsNotebooks();
    const data = notebooksRequest.data as any;
    let notebooks = data.notebooks ?? [];
    // 没有必要把所有笔记本都列出来
    notebooks = notebooks.filter((notebook) => !notebook.closed && !hiddenNotebook.has(notebook.name));
    notebooks.forEach(notebook => {
      const option = document.createElement("option");
      option.value = notebook.id;
      option.text = notebook.name;
      referenceNotebookSelector.appendChild(option);
    });
    // 默认笔记本为第一个打开的笔记本
    referenceNotebookSelector.value = this.plugin.data[STORAGE_NAME].referenceNotebook ?? notebooks[0].id;
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.notebookSelectorTitle,
        description: this.plugin.i18n.settingTab.notebookSelectorDescription,
        actionElement: referenceNotebookSelector,
    });

    //storage path input
    const referencePathInput = document.createElement("input");
    referencePathInput.className = "b3-text-field fn__size200";
    referencePathInput.placeholder = "Input the path";
    // 默认路径为"/References/"
    referencePathInput.value = this.plugin.data[STORAGE_NAME].referencePath ?? "/References";
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.referencePathInputTitle,
        description: this.plugin.i18n.settingTab.referencePathInputDescription,
        actionElement: referencePathInput,
    });

    //select the using type of database
    const databaseSelector = document.createElement("select");
    databaseSelector.className = "b3-select fn__flex-center fn__size200";
    databaseType.forEach(database => {
      const option = document.createElement("option");
      option.value = database;
      option.text = database;
      databaseSelector.appendChild(option);
    });
    databaseSelector.value = this.plugin.data[STORAGE_NAME].database ?? databaseType[0];
    this.setting.addItem({
      title: this.plugin.i18n.settingTab.databaseSelectorTitle,
      description: this.plugin.i18n.settingTab.databaseSelectorDescription,
      actionElement: databaseSelector,
    });

    // 是否使用itemKey作为文献内容索引
    const UseItemKeySwitch = document.createElement("input");
    UseItemKeySwitch.className = "b3-switch fn__flex-center";
    UseItemKeySwitch.type = "checkbox";
    // 默认关闭
    UseItemKeySwitch.checked = this.plugin.data[STORAGE_NAME].useItemKey ?? false;
    // 仅在选择debug-bridge情况下能够使用
    const value = databaseSelector.value;
    if (value === "Juris-M (debug-bridge)" || value === "Zotero (debug-bridge)") UseItemKeySwitch.disabled = false;
    else UseItemKeySwitch.disabled = true;
    // 同时绑定修改事件
    databaseSelector.onchange = function(ev) {
      const index = (ev.target as HTMLSelectElement).options.selectedIndex;
      const value = databaseType[index];
      if (value === "Juris-M (debug-bridge)" || value === "Zotero (debug-bridge)") UseItemKeySwitch.disabled = false;
      else {
        UseItemKeySwitch.checked = false;
        UseItemKeySwitch.disabled = true;
      }
    };
    this.setting.addItem({
      title: this.plugin.i18n.settingTab.UseItemKeySwitchTitle,
      description: this.plugin.i18n.settingTab.UseItemKeySwitchDescription,
      actionElement: UseItemKeySwitch,
    });

    //reload library button
    const reloadBtn = document.createElement("button");
    reloadBtn.className = "b3-button b3-button--outline fn__flex-center fn__size200";
    reloadBtn.textContent = this.plugin.i18n.settingTab.reloadBtnText;
    reloadBtn.addEventListener("click", async () => {
        await this.plugin.database.buildDatabase(databaseSelector.value as DatabaseType);
        return await this.plugin.reference.checkRefDirExist();
    });
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.reloadBtnTitle,
        description: this.plugin.i18n.settingTab.reloadBtnDescription,
        actionElement: reloadBtn,
    });

    // 文献内容标题模板
    const titleTemplateInput = document.createElement("input");
    titleTemplateInput.className = "b3-text-field fn__size200";
    titleTemplateInput.placeholder = "Input the path";
    titleTemplateInput.value = this.plugin.data[STORAGE_NAME].titleTemplate ?? defaultTitleTemplate;
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.titleTemplateInputTitle,
        description: this.plugin.i18n.settingTab.titleTemplateInputDescription,
        actionElement: titleTemplateInput,
    });

    //edit note template
    const noteTempTexarea = document.createElement("textarea");
    noteTempTexarea.className = "b3-text-field fn__block";
    noteTempTexarea.setAttribute("style", "resize:vertical");
    noteTempTexarea.setAttribute("rows", "10");
    noteTempTexarea.placeholder = "input the literature file template";
    noteTempTexarea.value = this.plugin.data[STORAGE_NAME].noteTemplate ?? defaultNoteTemplate;
    noteTempTexarea.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Tab") {
        ev.preventDefault();
        const indent = "\t";
        const start = noteTempTexarea.selectionStart;
        const end = noteTempTexarea.selectionEnd;
        let selected = window.getSelection().toString();
        selected = indent + selected.replace(/\n/g, "\n" + indent);
        noteTempTexarea.value = noteTempTexarea.value.substring(0, start) + selected
                + noteTempTexarea.value.substring(end);
        noteTempTexarea.setSelectionRange(start + indent.length, start
                + selected.length);
      }
    });
    this.setting.addItem({
      title: this.plugin.i18n.settingTab.noteTempTexareaTitle,
      description: this.plugin.i18n.settingTab.noteTempTexareaDescription,
      actionElement: noteTempTexarea,
    });

    // 切换能否完全自定义引用文本的开关
    const CustomCiteTextSwitch = document.createElement("input");
    CustomCiteTextSwitch.className = "b3-switch fn__flex-center";
    CustomCiteTextSwitch.type = "checkbox";
    // 默认关闭
    CustomCiteTextSwitch.checked = this.plugin.data[STORAGE_NAME].customCiteText ?? false;
    this.setting.addItem({
      title: this.plugin.i18n.settingTab.CustomCiteTextSwitchTitle,
      description: this.plugin.i18n.settingTab.CustomCiteTextSwitchDescription,
      actionElement: CustomCiteTextSwitch,
    });

    //edit literature link
    const linkTempInput = document.createElement("input");
    linkTempInput.className = "b3-text-field fn__size200";
    linkTempInput.placeholder = "Input the path";
    linkTempInput.value = this.plugin.data[STORAGE_NAME].linkTemplate ?? defaultLinkTemplate;
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.linkTempInputTitle,
        description: this.plugin.i18n.settingTab.linkTempInputDescription,
        actionElement: linkTempInput,
    });

    //delete data button
    const deleteDataBtn = document.createElement("button");
    deleteDataBtn.className = "b3-button b3-button--outline fn__flex-center fn__size200";
    deleteDataBtn.textContent = this.plugin.i18n.settingTab.deleteDataBtnText;
    deleteDataBtn.addEventListener("click", () => {
      confirm("⚠️", this.plugin.i18n.settingTab.confirmRemove.replace("${name}", this.plugin.name), () => {
        this.plugin.removeData(STORAGE_NAME).then(() => {
            referenceNotebookSelector.value = "";
            referencePathInput.value = defaultReferencePath;
            linkTempInput.value = defaultLinkTemplate;
            noteTempTexarea.value = defaultNoteTemplate;
            this.plugin.data[STORAGE_NAME] = {
                referenceNotebook: "",
                referencePath: defaultReferencePath,
                noteTemplate: defaultNoteTemplate,
                linkTemplate: defaultLinkTemplate
            };
            showMessage(`[${this.plugin.name}]: ${this.plugin.i18n.removedData}`);
        });
      });
    });
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.deleteDataBtnTitle,
        description: this.plugin.i18n.settingTab.deleteDataBtnDescription,
        actionElement: deleteDataBtn,
    });

    return this.setting;
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

  public async customCommand() {
    this.plugin.addCommand({
      langKey: "addCitation",
      hotkey: "⌥⇧A",
      editorCallback: async (p) => {
        const protyle = p.getInstance();
        if (isDev) this.logger.info("Slash触发：add literature citation", protyle);
        return this.plugin.database.insertCiteLink(protyle);
      },
      callback: () => {
        this.plugin.noticer.info("请使用快捷键调用此命令");
      }
    });
    this.plugin.addCommand({
      langKey: "reloadDatabase",
      hotkey: "",
      callback: async () => {
        if (isDev) this.logger.info("指令触发：reloadDatabase");
        await this.plugin.reference.checkRefDirExist();
        return this.plugin.database.buildDatabase(this.plugin.data[STORAGE_NAME].database as DatabaseType);
      }
    });
    this.plugin.addCommand({
      langKey: "refreshLiteratureNotesTitle",
      hotkey: "",
      callback: () => {
        if (isDev) this.logger.info("指令触发：refreshLiteratureNotesTitle");
        return this.plugin.reference.refreshLiteratureNoteTitles();
      }
    });
    this.plugin.addCommand({
      langKey: "copyCiteLink",
      hotkey: "",
      callback: () => {
        if (isDev) this.logger.info("指令触发：copyCiteLink");
        return this.plugin.database.copyCiteLink();
      }
    });
    this.plugin.addCommand({
      langKey: "copyNotes",
      hotkey: "",
      callback: () => {
        if (isDev) this.logger.info("指令触发：copyNotes");
        return this.plugin.database.copyNotes();
      }
    });
  }

  public eventBusReaction() {
    this.plugin.eventBus.on("click-editortitleicon", this.customTitleIconMenu.bind(this));
    this.plugin.eventBus.on("open-menu-breadcrumbmore", this.customBreadcrumbMore.bind(this));
    // this.plugin.eventBus.on("click-editorcontent", this.customTitleIconMenu);
  }

  private customTitleIconMenu(event: CustomEvent<any>) {
    if (isDev) this.logger.info("触发eventBus：click-editortitleicon，=>", event);
    const label = this.plugin.i18n.refreshCitation;
    const clickCallback = this.plugin.reference.updateLiteratureLink.bind(this.plugin.reference);
    event.detail.menu.addItem({
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