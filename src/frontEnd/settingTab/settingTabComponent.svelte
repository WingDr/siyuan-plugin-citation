<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { showMessage, confirm } from "siyuan";

  import SiYuanPluginCitation from "../../index";
  import {
    STORAGE_NAME,
    hiddenNotebook,
    databaseType,
    isDev,
    dbSearchDialogTypes,
    defaultSettingData
  } from "../../utils/constants";
  import { loadLocalRef } from "../../utils/util";
  import { type ILogger } from "../../utils/simple-logger";
  import { type DatabaseType } from "../../database/database";

  import { ItemType, type IOptions } from "./item/item";

  import Panels from "./panel/Panels.svelte";
  import Panel from "./panel/Panel.svelte";
  import Tabs from "./tab/Tabs.svelte";
  import Group from "./item/Group.svelte";
  import MiniItem from "./item/MiniItem.svelte";
  import Item from "./item/Item.svelte";
  import Input from "./item/Input.svelte";
  import Svg from "./../misc/Svg.svelte";
  import type { IPanel, ITab } from "./tab";
    import { max } from "moment";
    import Card from "./item/Card.svelte";

  interface Props {
    plugin: SiYuanPluginCitation;
    logger: ILogger;
    title?: import('svelte').Snippet;
    text?: import('svelte').Snippet;
    reloadDatabase: (database: string) => void;
    refreshLiteratureNoteTitle: (titleTemplate: string) => void;
  }

  interface AttrViewColumnConfig {
    keyID: string;
    name: string;
    type: string;
    mode: string;
    customValue: string;
  }

  const attrViewFillOptionDefs = [
    { key: "", text: "不填充", types: ["*"] },
    { key: "firstAuthor", text: "第一作者", types: ["select", "mSelect"] },
    { key: "correspondingAuthor", text: "通讯作者", types: ["select", "mSelect"] },
    { key: "journal", text: "发表期刊", types: ["select", "mSelect"] },
    { key: "date", text: "发表日期", types: ["date"] },
    { key: "zoteroUrl", text: "Zotero URL", types: ["url"] },
    { key: "url", text: "URL", types: ["url"] },
    { key: "custom", text: "自定义", types: ["*"] },
  ];

  function getFillOptionsForType(colType: string): IOptions {
    return attrViewFillOptionDefs
      .filter((def) => def.types.includes("*") || def.types.includes(colType))
      .map((def) => ({ key: def.key, text: def.text }));
  }

  function isModeAllowedForType(mode: string, colType: string): boolean {
    if (!mode || mode === "custom") return true;
    const def = attrViewFillOptionDefs.find((d) => d.key === mode);
    return !!def && (def.types.includes("*") || def.types.includes(colType));
  }

  function matchBuiltinModeByName(name: string): string {
    const map: Record<string, string> = {
      "第一作者": "firstAuthor",
      "通讯作者": "correspondingAuthor",
      "发表期刊": "journal",
      "发表日期": "date",
      "zotero url": "zoteroUrl",
      "zotero_url": "zoteroUrl",
      "zoterourl": "zoteroUrl",
      "url": "url",
      "链接": "url",
      "网址": "url",
    };
    return map[name.trim().toLowerCase()] ?? "";
  }

  function selectLikeValue(colType: string, contentTpl: string, colorTpl: string): string {
    // 思源单选/多选列统一使用 mSelect 格式，单选最多传一项
    return `{"mSelect":[{"content":"{{ ${contentTpl} }}","color":"{{ ${colorTpl} }}"}]}`;
  }

  function getBuiltinValueSnippet(mode: string, colType: string): string {
    const randColor = "(Math.floor(Math.random() * 13) + 1).toString()";
    switch (mode) {
      case "firstAuthor":
        return selectLikeValue(colType, "authorString ? authorString.split(', ')?.[0]:''", randColor);
      case "correspondingAuthor":
        return selectLikeValue(colType, "authorString ? authorString.split(', ').pop():''", randColor);
      case "journal":
        return selectLikeValue(colType, "containerTitle? containerTitle: ''", randColor);
      case "date":
        return `{"date":{"content":{{ issued && !isNaN(new Date(issued)) ? new Date(issued).getTime() : (year ? new Date(year, 0, 1).getTime() : '') }}, "isNotEmpty":{{ year ? 'true' : 'false' }}, "isNotTime":{{ year ? 'true' : 'false' }}}}`;
      case "zoteroUrl":
        return `{"url":{"content":"{{ zoteroSelectURI }}"}}`;
      case "url":
        return `{"url":{"content":"{{ DOI ? 'https://doi.org/'+DOI : (URL ? URL : '') }}"}}`;
      default:
        return "";
    }
  }

  function parseAttrViewTemplate(templateStr: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!templateStr || !templateStr.trim().length) return result;
    const s = templateStr.trim();
    if (!s.startsWith("[") || !s.endsWith("]")) return result;

    let i = 1;
    const len = s.length - 1;
    while (i < len) {
      while (i < len && /[\s,]/.test(s[i])) i++;
      if (i >= len || s[i] !== "{") {
        i++;
        continue;
      }
      const objStart = i;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (; i < s.length; i++) {
        const c = s[i];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (c === "\\") {
            escape = true;
          } else if (c === '"') {
            inString = false;
          }
          continue;
        }
        if (c === '"') {
          inString = true;
          continue;
        }
        // 跳过模板表达式 {{ 和 }}
        if (c === "{" && s[i + 1] === "{") {
          i++;
          continue;
        }
        if (c === "}" && s[i + 1] === "}") {
          i++;
          continue;
        }
        if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") depth--;
        if (depth === 0 && c === "}") {
          i++;
          break;
        }
      }
      const objStr = s.slice(objStart, i);
      const keyMatch = objStr.match(/"keyID"\s*:\s*"([^"]+)"/);
      if (!keyMatch) continue;
      const valueStart = objStr.indexOf("{", objStr.search(/"value"\s*:/));
      if (valueStart === -1) continue;
      let valueEnd = -1;
      let vDepth = 0;
      let vInString = false;
      let vEscape = false;
      for (let j = valueStart; j < objStr.length; j++) {
        const c = objStr[j];
        if (vInString) {
          if (vEscape) {
            vEscape = false;
          } else if (c === "\\") {
            vEscape = true;
          } else if (c === '"') {
            vInString = false;
          }
          continue;
        }
        if (c === '"') {
          vInString = true;
          continue;
        }
        // 跳过模板表达式 {{ 和 }}
        if (c === "{" && objStr[j + 1] === "{") {
          j++;
          continue;
        }
        if (c === "}" && objStr[j + 1] === "}") {
          j++;
          continue;
        }
        if (c === "{" || c === "[") vDepth++;
        else if (c === "}" || c === "]") vDepth--;
        if (vDepth === 0 && c === "}") {
          valueEnd = j + 1;
          break;
        }
      }
      if (valueEnd !== -1) {
        result[keyMatch[1]] = objStr.slice(valueStart, valueEnd);
      }
    }
    return result;
  }

  function buildAttrViewTemplate(configs: AttrViewColumnConfig[]): string {
    const entries = configs
      .filter((c) => c.mode && (c.mode !== "custom" || c.customValue.trim()))
      .map((c) => {
        const valueSnippet =
          c.mode === "custom" ? c.customValue : getBuiltinValueSnippet(c.mode, c.type);
        if (!valueSnippet) return null;
        return `  {\n    "keyID": "${c.keyID}",\n    "value": ${valueSnippet}\n  }`;
      })
      .filter((item): item is string => !!item);
    if (!entries.length) return "";
    return `[\n${entries.join(",\n")}\n]`;
  }

  let {
    plugin = $bindable(),
    logger,
    title,
    text,
    reloadDatabase,
    refreshLiteratureNoteTitle
  }: Props = $props();

  /**
   * 设置面板的设计
   * 1. 基础设置
   *    1. 插件版本和说明
   *    2. 笔记本选择
   *    3. 文献库路径
   *    4. 数据库类型
   *    5. 添加到的数据库id（用逗号隔开）
   *    6. 使用itemKey作为索引
   *    7. 自动替换指向zotero的链接为引用链接
   *    8. 关闭用户数据安全提示
   *    9. 重新载入数据库
   *    10. 删除数据
   * 2. 思源内容模板
   *    1. 引用链接
   *        1. 自定义引用
   *        2. 引用模板
   *        3. ShortAuthor字段最多显示的作者数
   *        4. 引用链接使用动态锚文本
   *    2. 文献内容
   *        1. 文献内容文档标题模板
   *        2. 刷新所有文献内容文档标题
   *        3. 文献内容模板
   *    3. 用户数据
   *        1. 自定义用户数据标题
   *        2. 在文档开头添加用户数据链接
   * 3. Zotero内容模板
   *    1. 插入zotero反向链接标题模板
   *    2. 插入zotero标签模板
   * 4. debug-bridge插件
   *    1. debug-bridge插件密码
   *    2. 插入文献时使用的搜索面板
  */

  // 显示数据
  const eMail = "siyuan_citation@126.com";
  const issuesURL = "https://github.com/WingDr/siyuan-plugin-citation/issues";
  let pluginVersion: string = $state("");
  let notebookOptions: IOptions = $state([]);
  let databaseOptions: IOptions = $state([]);
  let dbSearchDialogOptions: IOptions = $state([]);

  // 设定数据
  // 基本设定变量
  let referenceNotebook: string = $state()!;
  let referencePath: string = $state()!;
  let database: string = $state()!;
  let useItemKey: boolean = $state()!;
  let autoReplace: boolean = $state()!;
  let deleteUserDataWithoutConfirm: boolean = $state()!;
  let consoleDebug: boolean = $state()!;
  // 思源模板设定变量
  let titleTemplate: string = $state()!;
  let noteTemplate: string = $state()!;
  let moveImgToAssets: boolean = $state()!;
  let linkTemplate: string = $state()!;
  let customCiteText: boolean = $state()!;
  let useDynamicRefLink: boolean = $state()!;
  let nameTemplate: string = $state()!;
  let linkTemplatesGroup: {
    name: string,
    customCiteText: boolean,
    useDynamicRefLink: boolean,
    shortAuthorLimit: number,
    linkTemplate: string,
    multiCitePrefix: string,
    multiCiteConnector: string,
    multiCiteSuffix: string,
    nameTemplate: string
  }[] = $state([]);
  let shortAuthorLimit: number = $state()!;
  let multiCitePrefix: string = $state()!;
  let multiCiteConnector: string = $state()!;
  let multiCiteSuffix: string = $state()!;
  let citeName: string = $state()!;
  let useDefaultCiteType: boolean = $state()!;
  // 用户数据相关设定
  let userDataTitle: string = $state()!;
  let userDataTemplatePath: string = $state()!;
  let useWholeDocAsUserData: string = $state()!;
  // 数据库相关设定变量
  let attrViewBlock: string = $state()!;
  let attrViewColumnConfigs: AttrViewColumnConfig[] = $state([]);
  let attrViewCustomMap: Record<string, string> = $state({});
  let attrViewTemplate = $derived(buildAttrViewTemplate(attrViewColumnConfigs));
  // Zotero模板设定变量
  let zoteroLinkTitleTemplate: string = $state()!;
  let zoteroTagTemplate: string = $state()!;
  // debug-bridge变量
  let dbPassword: string = $state()!;
  let dbSearchDialogType: string = $state()!;
  // 导出相关变量
  let exportWordParam: string = $state("");
  let exportLaTeXParam: string = $state("");

  let settingIndex = $state(0);

  let show_link_detail = $state(false);

  let panel_focus_key = 1;
  const panels: IPanel[] = [
    {
      key: 1,
      text: (plugin.i18n.settingTab as any).basic.title,
      name: "citation-setting-basic",
      icon: "#iconSettings",
    },
    {
      key: 2,
      text: (plugin.i18n.settingTab as any).templates.title,
      name: "citation-setting-templates",
      icon: "#iconEdit",
    },
    {
      key: 3,
      text: (plugin.i18n.settingTab as any).debug_bridge.title,
      name: "citation-setting-debug-bridge",
      icon: "#iconPlugin",
      supportDatabase: ["Zotero (debug-bridge)", "Juris-M (debug-bridge)"],
    },
    {
      key: 4,
      text: (plugin.i18n.settingTab as any).export.title,
      name: "citation-setting-export",
      icon: "#iconUpload",
      supportDatabase: ["Zotero (debug-bridge)", "Juris-M (debug-bridge)"],
    },
  ];
  let displayPanels: ITab[] = $state([]);
  let template_tab_focus_key = 1;
  let template_tabs = [
    {
      key: 1,
      text: (plugin.i18n.settingTab as any).templates.citeLink.title,
      name: "citation-setting-template-cite-link",
      icon: "",
    },
    {
      key: 2,
      text: (plugin.i18n.settingTab as any).templates.literatureNote.title,
      name: "citation-setting-template-literature-note",
      icon: "",
    },
    {
      key: 3,
      text: (plugin.i18n.settingTab as any).templates.userData.title,
      name: "citation-setting-template-user-data",
      icon: "",
    }
  ];
  let debug_bridge_tab_focus_key = 1;
  let debug_bridge_tabs = [
    {
      key: 1,
      text: (plugin.i18n.settingTab as any).debug_bridge.plugin.title,
      name: "citation-setting-debug-bridge-plugin",
      icon: "",
    },
    {
      key: 2,
      text: (plugin.i18n.settingTab as any).debug_bridge.zotero.title,
      name: "citation-setting-debug-bridge-zotero",
      icon: "",
    },
  ]

  function generatePanels(panels: any[]) {
    return panels.reduce((acc, panel) => {
      if (
        !panel.supportDatabase ||
        panel.supportDatabase.indexOf(database) != -1
      ) {
        return [
          ...acc,
          {
            key: panel.key,
            text: panel.text,
            name: panel.name,
            icon: panel.icon,
          },
        ];
      } else {
        return acc;
      }
    }, []);
  }

  async function initializeData() {
    // 数据提前处理
    // 笔记本选择选项
    const notebooksRequest = await plugin.kernelApi.lsNotebooks();
    const data = notebooksRequest.data as any;
    let notebooks = data.notebooks ?? [];
    // 没有必要把所有笔记本都列出来
    notebooks = notebooks.filter(
      (notebook: { closed: any; name: string; }) => !notebook.closed && !hiddenNotebook.has(notebook.name)
    );
    notebookOptions = notebooks.map((notebook: { id: any; name: any; }) => {
      return {
        key: notebook.id,
        text: notebook.name,
      };
    });
    // 数据库类型选项
    databaseOptions = databaseType.map((database) => {
      return {
        key: database,
        text: database,
      };
    });
    // 搜索面板类型选项
    dbSearchDialogOptions = dbSearchDialogTypes.map((type) => {
      return {
        key: type,
        text: type
      }
    })

    // 默认笔记本为第一个打开的笔记本
    referenceNotebook = plugin.data[STORAGE_NAME]?.referenceNotebook ?? notebooks[0].id;
    // 默认文献库路径为"/References/"
    referencePath = plugin.data[STORAGE_NAME]?.referencePath ?? defaultSettingData.referencePath;
    // 使用itemKey默认关闭
    useItemKey = plugin.data[STORAGE_NAME]?.useItemKey ?? defaultSettingData.useItemKey;
    // 默认会自动替换zotero链接
    autoReplace = plugin.data[STORAGE_NAME]?.autoReplace ?? defaultSettingData.autoReplace;
    // 默认在删除用户数据时会弹出提示
    deleteUserDataWithoutConfirm = plugin.data[STORAGE_NAME]?.deleteUserDataWithoutConfirm ?? defaultSettingData.deleteUserDataWithoutConfirm;
    // 数据库类型默认为第一种
    database = plugin.data[STORAGE_NAME]?.database ?? defaultSettingData.database;
    // 默认标题模板
    titleTemplate = plugin.data[STORAGE_NAME]?.titleTemplate ?? defaultSettingData.titleTemplate;
    // 默认用户数据标题
    userDataTitle = plugin.data[STORAGE_NAME]?.userDataTitle ?? defaultSettingData.userDataTitle;
    // 默认用户数据模板路径
    userDataTemplatePath = plugin.data[STORAGE_NAME]?.userDataTemplatePath ?? defaultSettingData.userDataTemplatePath;
    // 默认是否使用整个文档作为用户数据
    useWholeDocAsUserData = plugin.data[STORAGE_NAME]?.useWholeDocAsUserData ?? defaultSettingData.useWholeDocAsUserData;
    // 默认文献内容模板
    noteTemplate = plugin.data[STORAGE_NAME]?.noteTemplate ?? defaultSettingData.noteTemplate;
    // 默认开启将图片转移到Assets
    moveImgToAssets = plugin.data[STORAGE_NAME]?.moveImgToAssets ?? defaultSettingData.moveImgToAssets;
    // 默认不开启自定义引用
    customCiteText = plugin.data[STORAGE_NAME]?.customCiteText ?? defaultSettingData.customCiteText;
    // 默认使用静态锚文本（不使用动态锚文本）
    useDynamicRefLink = plugin.data[STORAGE_NAME]?.useDynamicRefLink ?? defaultSettingData.useDynamicRefLink;
    // 默认不更新命名
    nameTemplate = plugin.data[STORAGE_NAME]?.nameTemplate ?? defaultSettingData.nameTemplate;
    // 默认引用链接模板
    linkTemplate = plugin.data[STORAGE_NAME]?.linkTemplate ?? defaultSettingData.linkTemplate;
    // 默认Zotero链接标题模板
    zoteroLinkTitleTemplate = plugin.data[STORAGE_NAME]?.zoteroLinkTitleTemplate ?? defaultSettingData.zoteroLinkTitleTemplate;
    // 默认Zotero标签模板
    zoteroTagTemplate = plugin.data[STORAGE_NAME]?.zoteroTagTemplate ?? defaultSettingData.zoteroTagTemplate;
    // 默认debug-bridge密码
    dbPassword = plugin.data[STORAGE_NAME]?.dbPassword ?? defaultSettingData.dbPassword;
    // 默认搜索面板类型
    dbSearchDialogType = plugin.data[STORAGE_NAME]?.dbSearchDialogType ?? defaultSettingData.dbSearchDialogType;
    // 默认shortAuthor长度
    shortAuthorLimit = plugin.data[STORAGE_NAME]?.shortAuthorLimit ?? defaultSettingData.shortAuthorLimit;
    // 默认数据库块id
    attrViewBlock = plugin.data[STORAGE_NAME]?.attrViewBlock ?? defaultSettingData.attrViewBlock;
    // 数据库列配置：优先读取已保存配置，否则从旧 attrViewTemplate 迁移
    attrViewColumnConfigs = plugin.data[STORAGE_NAME]?.attrViewColumnConfigs ?? defaultSettingData.attrViewColumnConfigs;
    attrViewCustomMap = parseAttrViewTemplate(plugin.data[STORAGE_NAME]?.attrViewTemplate ?? defaultSettingData.attrViewTemplate);
    getAttrViewSuggests(attrViewBlock);
    // 默认多个引用的前缀、后缀、连接符
    multiCitePrefix = plugin.data[STORAGE_NAME]?.multiCitePrefix ?? defaultSettingData.multiCitePrefix;
    multiCiteConnector = plugin.data[STORAGE_NAME]?.multiCiteConnector ?? defaultSettingData.multiCiteConnector;
    multiCiteSuffix = plugin.data[STORAGE_NAME]?.multiCiteSuffix ?? defaultSettingData.multiCiteSuffix;
    // 默认直接使用第一种引用类型
    useDefaultCiteType = plugin.data[STORAGE_NAME]?.useDefaultCiteType ?? defaultSettingData.useDefaultCiteType;
    // 默认引用链接模板细节
    linkTemplatesGroup = plugin.data[STORAGE_NAME]?.linkTemplatesGroup ?? [{
      name: "default",
      customCiteText,
      useDynamicRefLink,
      shortAuthorLimit,
      linkTemplate,
      multiCiteConnector,
      multiCitePrefix,
      multiCiteSuffix,
      nameTemplate
    }];
    // 默认不在控制台输出
    consoleDebug = plugin.data[STORAGE_NAME]?.consoleDebug ?? defaultSettingData.consoleDebug;
    // 默认导出Word和LaTex自定义参数为空
    exportWordParam = plugin.data[STORAGE_NAME]?.exportWordParam ?? defaultSettingData.exportWordParam;
    exportLaTeXParam = plugin.data[STORAGE_NAME]?.exportLaTeXParam ?? defaultSettingData.exportLaTeXParam;

    displayPanels = generatePanels(panels);
  }

  function _saveData() {
    // 将主要参数设置为第一组参数
    customCiteText = linkTemplatesGroup[0].customCiteText;
    useDynamicRefLink = linkTemplatesGroup[0].useDynamicRefLink;
    shortAuthorLimit = linkTemplatesGroup[0].shortAuthorLimit;
    linkTemplate = linkTemplatesGroup[0].linkTemplate;
    multiCitePrefix = linkTemplatesGroup[0].multiCitePrefix;
    multiCiteConnector = linkTemplatesGroup[0].multiCiteConnector;
    multiCiteSuffix = linkTemplatesGroup[0].multiCiteSuffix;
    nameTemplate = linkTemplatesGroup[0].nameTemplate;
    const storage_group = $state.snapshot(linkTemplatesGroup);
    const settingData = {
      referenceNotebook,
      referencePath,
      database,
      titleTemplate,
      userDataTitle,
      noteTemplate,
      moveImgToAssets,
      linkTemplate,
      nameTemplate,
      customCiteText,
      useItemKey,
      autoReplace,
      deleteUserDataWithoutConfirm,
      useDynamicRefLink,
      zoteroLinkTitleTemplate,
      zoteroTagTemplate,
      dbPassword,
      dbSearchDialogType,
      linkTemplatesGroup: storage_group,
      shortAuthorLimit,
      multiCitePrefix,
      multiCiteConnector,
      multiCiteSuffix,
      attrViewBlock,
      attrViewTemplate,
      attrViewColumnConfigs: $state.snapshot(attrViewColumnConfigs),
      useWholeDocAsUserData,
      userDataTemplatePath,
      useDefaultCiteType,
      consoleDebug,
      exportWordParam,
      exportLaTeXParam
    };
    if (settingData.database === "Zotero")
      settingData.database = "Zotero (better-bibtex)";
    else if (settingData.database === "Juris-M")
      settingData.database = "Juris-M (better-bibtex)";
    let refreshDatabase = false;
    let refreshName = false;
    // 改变了笔记本和数据库类型之后都要刷新数据库
    if (
      settingData.referenceNotebook !=
        plugin.data[STORAGE_NAME].referenceNotebook ||
      settingData.database != plugin.data[STORAGE_NAME].database
    )
      refreshDatabase = true;
    if (settingData.useItemKey != plugin.data[STORAGE_NAME].useItemKey)
      refreshName = true;
    plugin.data[STORAGE_NAME] = settingData;
    plugin.saveData(STORAGE_NAME, settingData).then(() => {
      if (refreshDatabase || refreshName) {
        plugin.reference.checkRefDirExist();
        plugin.database.buildDatabase(settingData.database as DatabaseType);
      }
      if (refreshName)
        plugin.noticer.info(
          ((plugin.i18n.notices as any).changeKey as string), {keyType: settingData.useItemKey ? "itemKey" : "citekey"}
        );
      if (isDev) logger.info("数据保存成功, settingData=>", settingData);
      if (referenceNotebook != plugin.data[STORAGE_NAME]?.referenceNotebook) {
        loadLocalRef(plugin);
      }
    });
  }

  function _checkDebugBridge(dtype: string): boolean {
    if (["Zotero (debug-bridge)", "Juris-M (debug-bridge)", "Zotero (Web API)", "Juris-M (Web API)"].indexOf(dtype) != -1) return true;
    else return false;
  }

  function _checkWebAPI(dtype: string): boolean {
    if (["Zotero (Web API)", "Juris-M (Web API)"].indexOf(dtype) != -1) return true;
    else return false;
  }

  onMount(async () => {
    const file = await plugin.kernelApi.getFile("/data/plugins/siyuan-plugin-citation/plugin.json", "json");
    pluginVersion = (file as any).version;
    await initializeData();
  });

  onDestroy(() => {
    if (isDev) logger.info("关闭设置界面");
    _saveData();
  });

  function clickCardSetting(event: any) {
    const target = event.target as HTMLElement;
    let button_id = target.parentElement!.getAttribute("id");
    if (!button_id) button_id = target.parentElement!.parentElement!.getAttribute("id");
    if (!button_id) button_id = target.parentElement!.parentElement!.parentElement!.getAttribute("id");
    const tmp = button_id!.split("_");
    const id  = eval(tmp[tmp.length-1]);
    if (show_link_detail && settingIndex == id) {
      show_link_detail = false;
      return;
    }
    settingIndex = id;
    const detail = linkTemplatesGroup[id];
    // 对具体的编辑框幅值
    citeName = detail.name;
    customCiteText = detail.customCiteText ?? defaultSettingData.customCiteText;
    useDynamicRefLink = detail.useDynamicRefLink ?? defaultSettingData.useDynamicRefLink;
    shortAuthorLimit = detail.shortAuthorLimit ?? defaultSettingData.shortAuthorLimit;
    linkTemplate = detail.linkTemplate ?? defaultSettingData.linkTemplate;
    multiCitePrefix = detail.multiCitePrefix ?? defaultSettingData.multiCitePrefix;
    multiCiteConnector = detail.multiCiteConnector ?? defaultSettingData.multiCiteConnector;
    multiCiteSuffix = detail.multiCiteSuffix ?? defaultSettingData.multiCiteSuffix;
    nameTemplate = detail.nameTemplate ?? defaultSettingData.nameTemplate;
    show_link_detail = true;
  }

  function addLinkTemp() {
    linkTemplatesGroup = [...linkTemplatesGroup, {
      name: "new",
      customCiteText,
      useDynamicRefLink,
      shortAuthorLimit,
      linkTemplate,
      multiCiteConnector,
      multiCitePrefix,
      multiCiteSuffix,
      nameTemplate
    }];
  }

  function deleteLinkTemp(event:any) {
    const target = event.target as HTMLElement;
    let button_id = target.parentElement!.getAttribute("id");
    if (!button_id) button_id = target.parentElement!.parentElement!.getAttribute("id");
    if (!button_id) button_id = target.parentElement!.parentElement!.parentElement!.getAttribute("id");
    const tmp = button_id!.split("_");
    const id  = eval(tmp[tmp.length-1]);
    linkTemplatesGroup = [...linkTemplatesGroup.slice(0, id), ...linkTemplatesGroup.slice(id+1)]
  }
  let isDebugBridge = $derived(_checkDebugBridge(database));
  let isWebAPI = $derived(_checkWebAPI(database));

  async function getAttrViewSuggests(attrViewBlock: string) {
    if (!attrViewBlock || !attrViewBlock.trim().length) {
      attrViewColumnConfigs = [];
      return;
    }
    try {
      let res = await plugin.kernelApi.getBlock(attrViewBlock);
      if (!res.data || !(res.data as any[]).length) {
        attrViewColumnConfigs = [];
        return;
      }
      const content = (res.data as any[])[0].markdown as string;
      const avIdReg = /.*data-av-id=\"(.*?)\".*/;
      const match = content.match(avIdReg);
      if (!match || !match[1]) {
        attrViewColumnConfigs = [];
        return;
      }
      const avID = match[1];
      res = await plugin.kernelApi.getAttributeView(avID);
      const av = (res.data as any).av;
      if (isDev) console.log("av=>", av);
      if (!av || !av.keyValues) {
        attrViewColumnConfigs = [];
        return;
      }
      const savedMap: Record<string, AttrViewColumnConfig> = {};
      for (const c of attrViewColumnConfigs) savedMap[c.keyID] = c;
      attrViewColumnConfigs = av.keyValues.map((item: { key: { id: string; name: string; type: string } }) => {
        const key = item.key;
        const saved = savedMap[key.id];
        const migratedCustom = attrViewCustomMap[key.id];
        let mode = saved?.mode ?? "";
        let customValue = saved?.customValue ?? "";
        if (!mode && migratedCustom !== undefined) {
          mode = "custom";
          customValue = migratedCustom;
        }
        if (!mode) {
          mode = matchBuiltinModeByName(key.name);
        }
        if (!isModeAllowedForType(mode, key.type)) {
          mode = "";
          customValue = "";
        }
        return {
          keyID: key.id,
          name: key.name,
          type: key.type,
          mode,
          customValue,
        };
      });
    } catch (error) {
      if (isDev) console.error("获取数据库列失败", error);
      attrViewColumnConfigs = [];
    }
  }
</script>

<Panels panels={displayPanels} focus={panel_focus_key} >
  {#snippet children({ focus: panel_focus })}
    <Panel display={panels[0].key === panel_focus}>
      <Item>
        {#snippet titleSlot()}
            <h4 >
            {(plugin.i18n.settingTab as any).settingTabTitle.replace(
              "${version}",
              pluginVersion
            )}
          </h4>
          {/snippet}
        {#snippet textSlot()}
            <span >
            {@html (plugin.i18n.settingTab as any).settingTabDescription
              .replaceAll("${e-mail}", eMail)
              .replace("${issuesURL}", issuesURL)}
          </span>
          {/snippet}
      </Item>

      <!-- 选择笔记本 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.notebookSelectorTitle}
        text={(plugin.i18n.settingTab as any).basic.notebookSelectorDescription}
      >
        {#snippet input()}
            <Input
            
            block={false}
            normal={true}
            type={ItemType.select}
            settingKey="Select"
            settingValue={referenceNotebook}
            options={notebookOptions}
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Select changed: ${event.detail.key} = ${event.detail.value}`
                );
              referenceNotebook = event.detail.value;
            }}
          />
          {/snippet}
      </Item>

      <!-- 设置文献库路径 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.referencePathInputTitle}
        text={(plugin.i18n.settingTab as any).basic.referencePathInputDescription}
      >
        {#snippet input()}
            <Input
            
            block={false}
            normal={true}
            type={ItemType.text}
            settingKey="Text"
            settingValue={referencePath}
            placeholder="Input the path"
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Input changed: ${event.detail.key} = ${event.detail.value}`
                );
              referencePath = event.detail.value;
            }}
          />
          {/snippet}
      </Item>

      <!-- 选择数据库类型 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.databaseSelectorTitle}
        text={(plugin.i18n.settingTab as any).basic.databaseSelectorDescription}
      >
        {#snippet input()}
            <Input
            
            block={false}
            normal={true}
            type={ItemType.select}
            settingKey="Select"
            settingValue={database}
            options={databaseOptions}
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Select changed: ${event.detail.key} = ${event.detail.value}`
                );
              database = event.detail.value;
              displayPanels = generatePanels(panels);
              if (!_checkDebugBridge(database)) useItemKey = false;
            }}
          />
          {/snippet}
      </Item>

      {#if isDebugBridge}
        <!-- 是否使用itemKey作为文献内容索引 -->
        <Item
          block={false}
          title={(plugin.i18n.settingTab as any).basic.UseItemKeySwitchTitle}
          text={isWebAPI
            ? "Web API 模式强制使用 itemKey 作为索引（无需 Better BibTeX 插件）。此选项仅对 debug-bridge 模式有效。"
            : (plugin.i18n.settingTab as any).basic.UseItemKeySwitchDescription}
        >
          {#snippet input()}
                <Input

              block={false}
              normal={true}
              type={ItemType.checkbox}
              settingKey="Checkbox"
              settingValue={isWebAPI ? true : useItemKey}
              disabled={isWebAPI}
              onchanged={(event) => {
                if (isDev)
                  logger.info(
                    `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                  );
                if (!isWebAPI) {
                  useItemKey = event.detail.value;
                }
              }}
            />
              {/snippet}
        </Item>
      {/if}

      <!-- 是否开启zotero链接自动替换 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.AutoReplaceSwitchTitle}
        text={(plugin.i18n.settingTab as any).basic.AutoReplaceSwitchDescription}
      >
        {#snippet input()}
          <Input
            block={false}
            normal={true}
            type={ItemType.checkbox}
            settingKey="Checkbox"
            settingValue={autoReplace}
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                );
                autoReplace = event.detail.value;
            }}
          />
          {/snippet}
      </Item>

      <!-- 是否选择不提示删除用户数据 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.DeleteUserDataWithoutConfirmSwitchTitle}
        text={(plugin.i18n.settingTab as any).basic.DeleteUserDataWithoutConfirmSwitchDescription}
      >
        {#snippet input()}
            <Input
            
            block={false}
            normal={true}
            type={ItemType.checkbox}
            settingKey="Checkbox"
            settingValue={deleteUserDataWithoutConfirm}
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                );
                deleteUserDataWithoutConfirm = event.detail.value;
            }}
          />
          {/snippet}
      </Item>

      <!-- 重载数据库 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.reloadBtnTitle}
        text={(plugin.i18n.settingTab as any).basic.reloadBtnDescription}
      >
        {#snippet input()}
            <Input
            
            block={false}
            normal={true}
            type={ItemType.button}
            settingKey="Button"
            settingValue={(plugin.i18n.settingTab as any).basic.reloadBtnText}
            onclicked={() => {
              if (isDev) logger.info("Button clicked");
              reloadDatabase(database);
              // dispatcher("reload database", { database });
            }}
          />
          {/snippet}
      </Item>

      <!-- 展示控制台debug数据 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.consoleDebugTitle}
        text={(plugin.i18n.settingTab as any).basic.consoleDebugDescription}
      >
        {#snippet input()}
          <Input
            block={false}
            normal={true}
            type={ItemType.checkbox}
            settingKey="Checkbox"
            settingValue={consoleDebug}
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                );
                consoleDebug = event.detail.value;
            }}
          />
          {/snippet}
      </Item>

      <!-- 删除数据 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.deleteDataBtnTitle}
        text={(plugin.i18n.settingTab as any).basic.deleteDataBtnDescription}
      >
        {#snippet input()}
            <Input
            
            block={false}
            normal={true}
            type={ItemType.button}
            settingKey="Button"
            settingValue={(plugin.i18n.settingTab as any).basic.deleteDataBtnText}
            onclicked={() => {
              if (isDev) logger.info("Button clicked");
              confirm(
                "⚠️",
                (plugin.i18n.settingTab as any).basic.confirmRemove.replace(
                  "${name}",
                  plugin.name
                ),
                () => {
                  plugin.removeData(STORAGE_NAME).then(async () => {
                    await initializeData()
                    plugin.data[STORAGE_NAME] = defaultSettingData;
                    plugin.noticer.info(`[${plugin.name}]: ${plugin.i18n.removedData}`);
                  });
                }
              );
            }}
          />
          {/snippet}
      </Item>
    </Panel>
    <Panel display={panels[1].key === panel_focus}>
      <Tabs focus={template_tab_focus_key} tabs={template_tabs} >
        {#snippet children({ focus })}
          <!-- 标签页 1 内容 -->
          <div data-type={template_tabs[0].name} class:fn__none={template_tabs[0].key !== focus}>
            <!-- 是否选择默认使用第一种引用类型 -->
            <Item
              block={false}
              title={(plugin.i18n.settingTab as any).templates.citeLink.useDefaultCiteTypeTitle}
              text={(plugin.i18n.settingTab as any).templates.citeLink.useDefaultCiteTypeDescription}
            >
              {#snippet input()}
                  <Input
                  block={false}
                  normal={true}
                  type={ItemType.checkbox}
                  settingKey="Checkbox"
                  settingValue={useDefaultCiteType}
                  onchanged={(event) => {
                    if (isDev)
                      logger.info(
                        `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                      );
                      useDefaultCiteType = event.detail.value;
                  }}
                />
                {/snippet}
            </Item> 
            <!-- 多个配置的卡片 -->
            <Group title={(plugin.i18n.settingTab as any).templates.citeLink.citeTypeCardTitle}>
              {#each linkTemplatesGroup as linkItem, index }
                <MiniItem minWidth="200px">
                  {#snippet title()}
                            <span data-type="title" id={"linkItem_" + index} >{@html linkItem.name}</span>
                          {/snippet}
                  {#snippet input()}
                            <div  style="display: flex;flex-direction:row" id={"linkItem_" + index}>
                      <button
                        class="b3-tooltips b3-tooltips__nw block__icon block__icon--show"
                        data-type="setting"
                        aria-label={(plugin.i18n.settingTab as any).templates.citeLink.citeTypeCardSet}
                        onclick={clickCardSetting}
                      >
                        <Svg
                          icon="#iconSettings"
                          className="svg"
                        />
                      </button>
                      <span class="fn__space" ></span>
                      <button
                        class="b3-tooltips b3-tooltips__nw block__icon block__icon--show"
                        data-type="delete"
                        aria-label={(plugin.i18n.settingTab as any).templates.citeLink.citeTypeCardDelete}
                        onclick={deleteLinkTemp}
                      >
                        <Svg
                          icon="#iconTrashcan"
                          className="svg"
                        />
                      </button>
                    </div>
                          {/snippet}
                </MiniItem>
              {/each}
              <Input
                block={false}
                normal={true}
                type={ItemType.button}
                settingKey="Button"
                settingValue={"添加"}
                onclicked={() => {
                  if (isDev) logger.info("Button clicked");
                  addLinkTemp();
                }}
              />
            </Group>

            <div style="margin: 5px 0;background:var(--b3-border-color);height:1px"></div>
            
            {#if show_link_detail}
              <!-- 引用类型名称 -->
              <Item
                block={true}
                title={(plugin.i18n.settingTab as any).templates.citeLink.citeNameTitle}
                text={(plugin.i18n.settingTab as any).templates.citeLink.citeNameDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={true}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={citeName}
                    placeholder="Input the citation link template"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      citeName = event.detail.value;
                      linkTemplatesGroup[settingIndex].name = citeName;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                {/snippet}
              </Item>
              <!-- 引用链接模板 -->
              <Item
                block={true}
                title={(plugin.i18n.settingTab as any).templates.citeLink.linkTempInputTitle}
                text={(plugin.i18n.settingTab as any).templates.citeLink.linkTempInputDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={true}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={linkTemplate}
                    placeholder="Input the citation link template"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      linkTemplate = event.detail.value;
                      linkTemplatesGroup[settingIndex].linkTemplate = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                      {/snippet}
              </Item>
              <!-- shortAuthor长度 -->
              <Item
                block={false}
                title={(plugin.i18n.settingTab as any).templates.citeLink.shortAuthorLimitTitle}
                text={(plugin.i18n.settingTab as any).templates.citeLink.shortAuthorLimitDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={false}
                    normal={true}
                    type={ItemType.number}
                    settingKey="Text"
                    settingValue={shortAuthorLimit}
                    placeholder="Input the citation link template"
                    limits={{min:1, max:10, step:1}}
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      shortAuthorLimit = event.detail.value;
                      linkTemplatesGroup[settingIndex].shortAuthorLimit = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                      {/snippet}
              </Item>
              <!-- 多文献引用设置 -->
              <label class="fn__flex b3-label">
                <div class="fn__flex-1">
                    {#if title}{@render title()}{:else}{@html (plugin.i18n.settingTab as any).templates.citeLink.multiCiteTitle}{/if}
                    <div class="b3-label__text">
                        {#if text}{@render text()}{:else}{@html (plugin.i18n.settingTab as any).templates.citeLink.multiCiteDescription}{/if}
                    </div>
                    
                </div>
                <div class="fn__space" ></div>
                <div style="display:flex;flex-direction:column;">
                  <Input
                    block={false}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={multiCitePrefix}
                    placeholder="Multi-Cite Prefix"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      multiCitePrefix = event.detail.value;
                      linkTemplatesGroup[settingIndex].multiCitePrefix = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                  <span class="fn__hr"></span>
                  <Input
                    block={false}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={multiCiteConnector}
                    placeholder="Multi-Cite Connector"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      multiCiteConnector = event.detail.value;
                      linkTemplatesGroup[settingIndex].multiCiteConnector = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  /> 
                  <span class="fn__hr"></span>
                  <Input
                    block={false}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={multiCiteSuffix}
                    placeholder="Multi-Cite Suffix"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      multiCiteSuffix = event.detail.value;
                      linkTemplatesGroup[settingIndex].multiCiteSuffix = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                </div>
            </label>
              <!-- 是否完全自定义引用 -->
              <Item
                block={false}
                title={(plugin.i18n.settingTab as any).templates.citeLink.CustomCiteTextSwitchTitle}
                text={(plugin.i18n.settingTab as any).templates.citeLink.CustomCiteTextSwitchDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={false}
                    normal={true}
                    type={ItemType.checkbox}
                    settingKey="Checkbox"
                    settingValue={customCiteText}
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      customCiteText = event.detail.value;
                      linkTemplatesGroup[settingIndex].customCiteText = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                      {/snippet}
              </Item>
              <!-- 是否使用动态锚文本-->
              <Item
                block={false}
                title={(plugin.i18n.settingTab as any).templates.citeLink.useDynamicRefLinkSwitchTitle}
                text={(plugin.i18n.settingTab as any).templates.citeLink.useDynamicRefLinkSwitchDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={false}
                    normal={true}
                    type={ItemType.checkbox}
                    settingKey="Checkbox"
                    settingValue={useDynamicRefLink}
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      useDynamicRefLink = event.detail.value;
                      linkTemplatesGroup[settingIndex].useDynamicRefLink = event.detail.value;
                      linkTemplatesGroup = linkTemplatesGroup;
                    }}
                  />
                      {/snippet}
              </Item>
              {#if customCiteText && useDynamicRefLink}
                <!-- 文献内容文档命名模板 -->
                <Item
                  block={true}
                  title={(plugin.i18n.settingTab as any).templates.citeLink.nameTempInputTitle}
                  text={(plugin.i18n.settingTab as any).templates.citeLink.nameTempInputDescription}
                >
                  {#snippet input()}
                            <Input
                      
                      block={true}
                      normal={true}
                      type={ItemType.text}
                      settingKey="Text"
                      settingValue={nameTemplate}
                      placeholder="Input the literature note's name template"
                      onchanged={(event) => {
                        if (isDev)
                          logger.info(
                            `Input changed: ${event.detail.key} = ${event.detail.value}`
                          );
                        nameTemplate = event.detail.value;
                        linkTemplatesGroup[settingIndex].nameTemplate = event.detail.value;
                        linkTemplatesGroup = linkTemplatesGroup;
                      }}
                    />
                          {/snippet}
                </Item>
              {/if}
            {/if}
          </div>

        <!-- 标签页 2 内容 -->
        <div data-type={template_tabs[1].name} class:fn__none={template_tabs[1].key !== focus}>
          <!-- 文档标题模板 -->
          <Item
            block={true}
            title={(plugin.i18n.settingTab as any).templates.literatureNote.titleTemplateInputTitle}
            text={(plugin.i18n.settingTab as any).templates.literatureNote.titleTemplateInputDescription}
          >
            {#snippet input()}
                  <Input
                
                block={true}
                normal={true}
                type={ItemType.text}
                settingKey="Text"
                settingValue={titleTemplate}
                placeholder="Input the title template"
                onchanged={(event) => {
                  if (isDev)
                    logger.info(
                      `Input changed: ${event.detail.key} = ${event.detail.value}`
                    );
                  titleTemplate = event.detail.value;
                }}
              />
                {/snippet}
          </Item>
          <!-- 刷新全部文档标题 -->
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).templates.literatureNote.refreshLiteratureNoteBtnTitle}
            text={(plugin.i18n.settingTab as any).templates.literatureNote.refreshLiteratureNoteBtnDesciption}
          >
            {#snippet input()}
                  <Input
                
                block={false}
                normal={true}
                type={ItemType.button}
                settingKey="Button"
                settingValue={(plugin.i18n.settingTab as any).templates.literatureNote.refreshLiteratureNoteBtnText}
                onclicked={() => {
                  if (isDev) logger.info("Button clicked");
                  refreshLiteratureNoteTitle(titleTemplate);
                  // dispatcher("refresh literature note title", { titleTemplate });
                }}
              />
                {/snippet}
          </Item>
          <!-- 是否选择移动图片到Assets -->
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).templates.literatureNote.moveImgToAssetsTitle}
            text={(plugin.i18n.settingTab as any).templates.literatureNote.moveImgToAssetsDescription}
          >
            {#snippet input()}
                <Input
                block={false}
                normal={true}
                type={ItemType.checkbox}
                settingKey="Checkbox"
                settingValue={moveImgToAssets}
                onchanged={(event) => {
                  if (isDev)
                    logger.info(
                      `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                    );
                    moveImgToAssets = event.detail.value;
                }}
              />
              {/snippet}
          </Item> 
          <!-- 文献内容模板 -->
          <Item
            block={true}
            title={(plugin.i18n.settingTab as any).templates.literatureNote.noteTempTexareaTitle}
            text={(plugin.i18n.settingTab as any).templates.literatureNote.noteTempTexareaDescription}
          >
            {#snippet input()}
                  <Input
                
                block={true}
                normal={true}
                rows={10}
                type={ItemType.textarea}
                settingKey="Textarea"
                settingValue={noteTemplate}
                placeholder="Input the literature note template"
                onchanged={(event) => {
                  if (isDev)
                    logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                    );
                  noteTemplate = event.detail.value;
                }}
              />
                {/snippet}
          </Item>
        </div>

        <!-- 标签页 3 内容 -->
        <div data-type={template_tabs[2].name} class:fn__none={template_tabs[2].key !== focus}>
          {#if !useWholeDocAsUserData}
            <!-- 自定义用户数据标题 -->
            <Item
              block={true}
              title={(plugin.i18n.settingTab as any).templates.userData.titleUserDataInput}
              text={(plugin.i18n.settingTab as any).templates.userData.titleUserDataInputDescription}
            >
              {#snippet input()}
                    <Input
                  
                  block={true}
                  normal={true}
                  type={ItemType.text}
                  settingKey="Text"
                  settingValue={userDataTitle}
                  placeholder="Input the 'User Data' title"
                  onchanged={(event) => {
                    if (isDev)
                      logger.info(
                      `Input changed: ${event.detail.key} = ${event.detail.value}`
                    );
                    userDataTitle = event.detail.value; 
                  }}
                />
                  {/snippet}
            </Item>
          {/if}
          <!-- 用户数据模板路径 -->
          <Item
            block={true}
            title={(plugin.i18n.settingTab as any).templates.userData.userDataTemplatePathTitle}
            text={(plugin.i18n.settingTab as any).templates.userData.userDataTemplatePathDescription}
          >
            {#snippet input()}
              <Input
                block={true}
                normal={true}
                type={ItemType.text}
                settingKey="Text"
                settingValue={userDataTemplatePath}
                placeholder="/data/templates/template.md"
                onchanged={(event) => {
                  if (isDev)
                    logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                  userDataTemplatePath = event.detail.value;
                }}
              />
            {/snippet}
          </Item>
          <!-- 是否使用整个文献内容文档作为用户数据 -->
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).templates.userData.useWholeDocAsUserDataTitle}
            text={(plugin.i18n.settingTab as any).templates.userData.useWholeDocAsUserDataDescription}
          >
            {#snippet input()}
              <Input
                block={false}
                normal={true}
                type={ItemType.checkbox}
                settingKey="Checkbox"
                settingValue={useWholeDocAsUserData}
                onchanged={(event) => {
                  if (isDev)
                    logger.info(
                      `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                    );
                  useWholeDocAsUserData = event.detail.value;
                }}
              />
                {/snippet}
          </Item>
          <!-- 数据库块id -->
          <Item
            block={true}
            title={(plugin.i18n.settingTab as any).templates.userData.attrViewBlockInput}
            text={(plugin.i18n.settingTab as any).templates.userData.attrViewBlockDescription}
          >
            {#snippet input()}
                  <Input
                
                block={true}
                normal={true}
                type={ItemType.text}
                settingKey="Text"
                settingValue={attrViewBlock}
                placeholder="Input the attribute view block id"
                onchanged={async (event) => {
                  if (isDev)
                    logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                  attrViewBlock = event.detail.value; 
                  getAttrViewSuggests(attrViewBlock);
                }}
              />
                {/snippet}
          </Item>
          <!-- 数据库属性模板 -->
          <Item
            block={true}
            title={(plugin.i18n.settingTab as any).templates.userData.attrViewTemplateInput}
            text="选择数据库每一列的填充方式，内置选项会根据列类型自动生成对应值；选择“自定义”可填写模板片段。"
          >
            {#snippet input()}
              <div style="width:100%; overflow-x:auto;">
                {#if attrViewColumnConfigs.length}
                  <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                      <tr style="border-bottom:1px solid var(--b3-border-color);">
                        <th style="text-align:left; padding:6px;">列名</th>
                        <th style="text-align:left; padding:6px;">类型</th>
                        <th style="text-align:left; padding:6px;">填充方式</th>
                        <th style="text-align:left; padding:6px;">自定义模板</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each attrViewColumnConfigs as col, index}
                        <tr style="border-bottom:1px solid var(--b3-border-color);">
                          <td style="padding:6px;">{col.name}</td>
                          <td style="padding:6px;">{col.type}</td>
                          <td style="padding:6px;">
                            <Input
                              block={false}
                              normal={true}
                              type={ItemType.select}
                              settingKey="Select"
                              settingValue={col.mode}
                              options={getFillOptionsForType(col.type)}
                              onchanged={(event) => {
                                if (isDev) logger.info(`Select changed: ${event.detail.key} = ${event.detail.value}`);
                                col.mode = event.detail.value;
                                attrViewColumnConfigs = [...attrViewColumnConfigs];
                              }}
                            />
                          </td>
                          <td style="padding:6px; min-width:200px;">
                            {#if col.mode === 'custom'}
                              <textarea
                                class="b3-text-field"
                                style="width:100%; min-width:200px;"
                                rows="3"
                                placeholder={"{\"...\": \"...\"}"}
                                bind:value={col.customValue}
                                onchange={() => {
                                  attrViewColumnConfigs = [...attrViewColumnConfigs];
                                }}
                              ></textarea>
                            {:else}
                              <span style="color:var(--b3-theme-on-surface-light);">—</span>
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {:else}
                  <div class="b3-label__text">请输入正确的数据库块 ID 以加载列</div>
                {/if}
              </div>
            {/snippet}
          </Item>
        </div>
        {/snippet}
      </Tabs>
    </Panel>

    <Panel display={panels[2].key === panel_focus}>
      <Tabs focus={debug_bridge_tab_focus_key} tabs={debug_bridge_tabs} >
        {#snippet children({ focus })}
            <!-- 标签页 1 内容 -->
          <div data-type={debug_bridge_tabs[0].name} class:fn__none={debug_bridge_tabs[0].key !== focus}>
            <!-- debug-bridge密码 -->
            <Item
              block={false}
              title={(plugin.i18n.settingTab as any).debug_bridge.plugin.dbPasswordInputTitle}
              text={(plugin.i18n.settingTab as any).debug_bridge.plugin.dbPasswordInputDescription}
            >
              {#snippet input()}
                    <Input
                  
                  block={false}
                  normal={true}
                  type={ItemType.text}
                  settingKey="Text"
                  settingValue={dbPassword}
                  placeholder="Input debug-bridge password"
                  onchanged={(event) => {
                    if (isDev)
                      logger.info(
                        `Input changed: ${event.detail.key} = ${event.detail.value}`
                      );
                    dbPassword = event.detail.value;
                  }}
                />
                  {/snippet}
            </Item>
            <!-- 使用的搜索面板 -->
            <Item
              block={false}
              title={(plugin.i18n.settingTab as any).debug_bridge.plugin.searchDialogSelectorTitle}
              text={(plugin.i18n.settingTab as any).debug_bridge.plugin.searchDialogSelectorDescription}
            >
              {#snippet input()}
                    <Input
                  
                  block={false}
                  normal={true}
                  type={ItemType.select}
                  settingKey="Select"
                  settingValue={dbSearchDialogType}
                  options={dbSearchDialogOptions}
                  onchanged={(event) => {
                    if (isDev)
                      logger.info(
                        `Select changed: ${event.detail.key} = ${event.detail.value}`
                      );
                    dbSearchDialogType = event.detail.value;
                  }}
                />
                  {/snippet}
            </Item>
          </div>

          <!-- 标签页 2 内容 -->
          <div data-type={debug_bridge_tabs[1].name} class:fn__none={debug_bridge_tabs[1].key !== focus}>
            {#if !isDebugBridge}
              <Item>
                {#snippet titleSlot()}
                        <h3 >
                    {(plugin.i18n.settingTab as any).debug_bridge.zotero.notAbleTitle}
                  </h3>
                      {/snippet}
                {#snippet textSlot()}
                        <span >
                    {@html (plugin.i18n.settingTab as any).debug_bridge.zotero.notAbleDescription}
                  </span>
                      {/snippet}
              </Item>
            {:else}
              <Item
                block={false}
                title={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroLinkTitleTemplateTitle}
                text={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroLinkTitleTemplateDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={false}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={zoteroLinkTitleTemplate}
                    placeholder="Input the title"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                      zoteroLinkTitleTemplate = event.detail.value;
                    }}
                  />
                      {/snippet}
              </Item>
              <Item
                block={false}
                title={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroTagTemplateTitle}
                text={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroTagTemplateDescription}
              >
                {#snippet input()}
                        <Input
                    
                    block={false}
                    normal={true}
                    type={ItemType.text}
                    settingKey="Text"
                    settingValue={zoteroTagTemplate}
                    placeholder="Input the tags"
                    onchanged={(event) => {
                      if (isDev)
                        logger.info(
                          `Input changed: ${event.detail.key} = ${event.detail.value}`
                        );
                        zoteroTagTemplate = event.detail.value;
                    }}
                  />
                      {/snippet}
              </Item>
            {/if}
          </div>
                  {/snippet}
        </Tabs>
    </Panel>
    <Panel display={panels[3].key === panel_focus}>
      <!-- 导出word的pandoc参数 -->
      <Item
        block={true}
        title={(plugin.i18n.settingTab as any).export.exportWordParamTitle}
        text={(plugin.i18n.settingTab as any).export.exportWordParamDescription}
      >
        {#snippet input()}
              <Input
            
            block={true}
            normal={true}
            type={ItemType.text}
            settingKey="Text"
            settingValue={exportWordParam}
            placeholder="Input the params"
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Input changed: ${event.detail.key} = ${event.detail.value}`
                );
              exportWordParam = event.detail.value;
            }}
          />
            {/snippet}
      </Item>

      <!-- 导出LaTex的pandoc参数 -->
      <Item
        block={true}
        title={(plugin.i18n.settingTab as any).export.exportLaTeXParamTitle}
        text={(plugin.i18n.settingTab as any).export.exportLaTeXParamDescription}
      >
        {#snippet input()}
              <Input
            
            block={true}
            normal={true}
            type={ItemType.text}
            settingKey="Text"
            settingValue={exportLaTeXParam}
            placeholder="Input the params"
            onchanged={(event) => {
              if (isDev)
                logger.info(
                  `Input changed: ${event.detail.key} = ${event.detail.value}`
                );
              exportLaTeXParam = event.detail.value;
            }}
          />
            {/snippet}
      </Item>
    </Panel>
  {/snippet}
</Panels>
