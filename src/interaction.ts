import {
  Setting,
  showMessage,
  confirm,
  Protyle
} from "siyuan";
import SiYuanPluginCitation from "./index";
import {
  STORAGE_NAME,
  hiddenNotebook,
  defaultNoteTemplate,
  defaultLinkTemplate,
  defaultReferencePath,
  isDev
} from "./utils/constants";
import {
  loadLibrary,
  loadLocalRef
} from "./utils/util";
import { createLogger, ILogger } from "./utils/simple-logger";

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
            const settingData = {
                referenceNotebook: referenceNotebookSelector.value,
                referencePath: referencePathInput.value,
                noteTemplate: noteTempTexarea.value,
                linkTemplate: linkTempInput.value
            };
            this.plugin.saveData(STORAGE_NAME, settingData);
        }
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

    //reload library button
    const reloadBtn = document.createElement("button");
    reloadBtn.className = "b3-button b3-button--outline fn__flex-center fn__size200";
    reloadBtn.textContent = this.plugin.i18n.settingTab.reloadBtnText;
    reloadBtn.addEventListener("click", () => {
        return loadLibrary(this.plugin).then(() => loadLocalRef(this.plugin));
    });
    this.setting.addItem({
        title: this.plugin.i18n.settingTab.reloadBtnTitle,
        description: this.plugin.i18n.settingTab.reloadBtnDescription,
        actionElement: reloadBtn,
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
      } else if (ev.key === "Enter") {
        console.log(ev);
        ev.preventDefault();
        const indent = "\n";
        const start = noteTempTexarea.selectionStart;
        const end = noteTempTexarea.selectionEnd;
        noteTempTexarea.value = noteTempTexarea.value.substring(0, start) + indent
                + noteTempTexarea.value.substring(end);
        noteTempTexarea.setSelectionRange(start + indent.length, start
                + indent.length);
        return false;
      }
    });
    this.setting.addItem({
      title: this.plugin.i18n.settingTab.noteTempTexareaTitle,
      description: this.plugin.i18n.settingTab.noteTempTexareaDescription,
      actionElement: noteTempTexarea,
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
    return {
      filter: [this.plugin.i18n.addCitation, "插入文献引用", "add an citation", "charuwenxianyinyong"],
      html: `<div class = "b3-list-item__first">
        <svg class="b3-list-item__graphic">
          <use xlink:href="#iconRef"></use>
        </svg>
        <span class="b3-list-item__text">${this.plugin.i18n.addCitation}</span>
      </div>`,
      id: "add-literature-citation",
      callback: async (protyle: Protyle) => {
        if (isDev) this.logger.info("Slash触发：add literature citation", protyle);
        if (this.plugin.data[STORAGE_NAME].referenceNotebook === "") {
          this.plugin.noticer.error(this.plugin.i18n.errors.notebookUnselected);
          if (isDev) this.logger.error("未选择笔记本！");
        } else if (!this.plugin.isRefPathExist) {
          protyle.insert("", false, true);
          this.plugin.noticer.error(this.plugin.i18n.errors.refPathInvalid);
          if (isDev) this.logger.error("文献库路径不存在！");
        } else {
          return this.plugin.insertModal.showSearching(protyle);
        }
      }
    };
  }

  public async customCommand() {
    this.plugin.addCommand({
      langKey: "addCitation",
      hotkey: "⇧⌘M",
      editorCallback: (protyle: any) => {
        if (isDev) this.logger.info("指令触发：addCitation", protyle);
        if (this.plugin.data[STORAGE_NAME].referenceNotebook === "") {
          this.plugin.noticer.error(this.plugin.i18n.errors.notebookUnselected);
          if (isDev) this.logger.error("未选择笔记本！");
        } else if (!this.plugin.isRefPathExist) {
          this.plugin.noticer.error(this.plugin.i18n.errors.refPathInvalid);
          if (isDev) this.logger.error("文献库路径不存在！");
        } else {
          return this.plugin.insertModal.showSearching(protyle);
        }
        return;
      },
      callback: () => {
        this.plugin.noticer.error(this.plugin.i18n.errors.hotKeyUsage);
      },
    });
    this.plugin.addCommand({
      langKey: "refreshLibrary",
      hotkey: "",
      callback: () => {
        this.logger.info("指令触发：refreshLibrary");
        return loadLibrary(this.plugin).then(() => loadLocalRef(this.plugin));
      }
    });
  }

  public eventBusReaction() {
    // TODO 绑定eventBus的话this就跑飞了，看看要不要提issue
    // this.plugin.eventBus.on("click-editortitleicon", this.customTitleIconMenu);
  }

  // private customTitleIconMenu(event: CustomEvent<any>) {
  //   const label = this.plugin.i18n.refreshCitation;
  //   const clickCallback = this.plugin.reference.updateLiteratureLink;
  //   event.detail.menu.addItem({
  //     iconHTML: "",
  //     label: label,
  //     click: () => {clickCallback(event.detail.data.id);}
  //   });
  // }

  public generateCiteRef(citeFileId: string, link: string) {
    return `<span data-type="block-ref" data-subtype="d" data-id="${citeFileId}">${link}</span>`;
  }
}