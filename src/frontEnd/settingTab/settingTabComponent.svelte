<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
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

  export let plugin: SiYuanPluginCitation;
  export let logger: ILogger;

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
  let pluginVersion: string;
  let notebookOptions: IOptions;
  let databaseOptions: IOptions;
  let dbSearchDialogOptions: IOptions;

  // 设定数据
  // 基本设定变量
  let referenceNotebook: string;
  let referencePath: string;
  let database: string;
  let useItemKey: boolean;
  let autoReplace: boolean;
  let deleteUserDataWithoutConfirm: boolean;
  // 思源模板设定变量
  let titleTemplate: string;
  let userDataTitle: string;
  let noteTemplate: string;
  let linkTemplate: string;
  let customCiteText: boolean;
  let useDynamicRefLink: boolean;
  let nameTemplate: string;
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
  }[] = [];
  let shortAuthorLimit: number;
  let multiCitePrefix: string;
  let multiCiteConnector: string;
  let multiCiteSuffix: string;
  let citeName: string;
  // Zotero模板设定变量
  let zoteroLinkTitleTemplate: string;
  let zoteroTagTemplate: string;
  // debug-bridge变量
  let dbPassword: string;
  let dbSearchDialogType: string;
  
  let settingIndex = 0;

  let show_link_detail = false;

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
  ];
  let displayPanels: ITab[] = [];
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
    },
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

  $: isDebugBridge = _checkDebugBridge(database);

  const dispatcher = createEventDispatcher();

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
    // 默认文献内容模板
    noteTemplate = plugin.data[STORAGE_NAME]?.noteTemplate ?? defaultSettingData.noteTemplate;
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
    // 默认多个引用的前缀、后缀、连接符
    multiCitePrefix = plugin.data[STORAGE_NAME]?.multiCitePrefix ?? defaultSettingData.multiCitePrefix;
    multiCiteConnector = plugin.data[STORAGE_NAME]?.multiCiteConnector ?? defaultSettingData.multiCiteConnector;
    multiCiteSuffix = plugin.data[STORAGE_NAME]?.multiCiteSuffix ?? defaultSettingData.multiCiteSuffix;
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

    displayPanels = generatePanels(panels);
  }

  function _checkDebugBridge(dtype: string): boolean {
    if (["Zotero (debug-bridge)", "Juris-M (debug-bridge)"].indexOf(dtype) != -1) return true;
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
    const settingData = {
      referenceNotebook,
      referencePath,
      database,
      titleTemplate,
      userDataTitle,
      noteTemplate,
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
      linkTemplatesGroup,
      shortAuthorLimit,
      multiCitePrefix,
      multiCiteConnector,
      multiCiteSuffix
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
          (plugin.i18n.notices.changeKey as string), {keyType: settingData.useItemKey ? "itemKey" : "citekey"}
        );
      if (isDev) logger.info("数据保存成功, settingData=>", settingData);
    });
  }

  function clickCardSetting(event: any) {
    const target = event.target as HTMLElement;
    let button_id = target.parentElement.parentElement.parentElement.getAttribute("id");
    if (!button_id) button_id = target.parentElement.parentElement.getAttribute("id");
    if (!button_id) button_id = target.parentElement.getAttribute("id");
    const tmp = button_id.split("_");
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
    let button_id = target.parentElement.parentElement.parentElement.getAttribute("id");
    if (!button_id) button_id = target.parentElement.parentElement.getAttribute("id");
    if (!button_id) button_id = target.parentElement.getAttribute("id");
    const tmp = button_id.split("_");
    const id  = eval(tmp[tmp.length-1]);
    linkTemplatesGroup = [...linkTemplatesGroup.slice(0, id), ...linkTemplatesGroup.slice(id+1)]
  }
</script>

<Panels panels={displayPanels} focus={panel_focus_key} let:focus={panel_focus}>
  <Panel display={panels[0].key === panel_focus}>
    <Item>
      <h4 slot="title">
        {(plugin.i18n.settingTab as any).settingTabTitle.replace(
          "${version}",
          pluginVersion
        )}
      </h4>
      <span slot="text">
        {@html (plugin.i18n.settingTab as any).settingTabDescription
          .replaceAll("${e-mail}", eMail)
          .replace("${issuesURL}", issuesURL)}
      </span>
    </Item>

    <!-- 选择笔记本 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.notebookSelectorTitle}
      text={(plugin.i18n.settingTab as any).basic.databaseSelectorDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.select}
        settingKey="Select"
        settingValue={referenceNotebook}
        options={notebookOptions}
        on:changed={(event) => {
          if (isDev)
            logger.info(
              `Select changed: ${event.detail.key} = ${event.detail.value}`
            );
          referenceNotebook = event.detail.value;
        }}
      />
    </Item>

    <!-- 设置文献库路径 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.referencePathInputTitle}
      text={(plugin.i18n.settingTab as any).basic.referencePathInputDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.text}
        settingKey="Text"
        settingValue={referencePath}
        placeholder="Input the path"
        on:changed={(event) => {
          if (isDev)
            logger.info(
              `Input changed: ${event.detail.key} = ${event.detail.value}`
            );
          referencePath = event.detail.value;
        }}
      />
    </Item>

    <!-- 选择数据库类型 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.databaseSelectorTitle}
      text={(plugin.i18n.settingTab as any).basic.databaseSelectorDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.select}
        settingKey="Select"
        settingValue={database}
        options={databaseOptions}
        on:changed={(event) => {
          if (isDev)
            logger.info(
              `Select changed: ${event.detail.key} = ${event.detail.value}`
            );
          database = event.detail.value;
          displayPanels = generatePanels(panels);
          if (!_checkDebugBridge(database)) useItemKey = false;
        }}
      />
    </Item>

    {#if isDebugBridge}
      <!-- 是否使用itemKey作为文献内容索引 -->
      <Item
        block={false}
        title={(plugin.i18n.settingTab as any).basic.UseItemKeySwitchTitle}
        text={(plugin.i18n.settingTab as any).basic.UseItemKeySwitchDescription}
      >
        <Input
          slot="input"
          block={false}
          normal={true}
          type={ItemType.checkbox}
          settingKey="Checkbox"
          settingValue={useItemKey}
          on:changed={(event) => {
            if (isDev)
              logger.info(
                `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
              );
            useItemKey = event.detail.value;
          }}
        />
      </Item>
    {/if}

    <!-- 是否开启zotero链接自动替换 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.AutoReplaceSwitchTitle}
      text={(plugin.i18n.settingTab as any).basic.AutoReplaceSwitchDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.checkbox}
        settingKey="Checkbox"
        settingValue={autoReplace}
        on:changed={(event) => {
          if (isDev)
            logger.info(
              `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
            );
            autoReplace = event.detail.value;
        }}
      />
    </Item>

    <!-- 是否选择不提示删除用户数据 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.DeleteUserDataWithoutConfirmSwitchTitle}
      text={(plugin.i18n.settingTab as any).basic.DeleteUserDataWithoutConfirmSwitchDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.checkbox}
        settingKey="Checkbox"
        settingValue={deleteUserDataWithoutConfirm}
        on:changed={(event) => {
          if (isDev)
            logger.info(
              `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
            );
            deleteUserDataWithoutConfirm = event.detail.value;
        }}
      />
    </Item>

    <!-- 重载数据库 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.reloadBtnTitle}
      text={(plugin.i18n.settingTab as any).basic.reloadBtnDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.button}
        settingKey="Button"
        settingValue={(plugin.i18n.settingTab as any).basic.reloadBtnText}
        on:clicked={() => {
          if (isDev) logger.info("Button clicked");
          dispatcher("reload database", { database });
        }}
      />
    </Item>

    <!-- 删除数据 -->
    <Item
      block={false}
      title={(plugin.i18n.settingTab as any).basic.deleteDataBtnTitle}
      text={(plugin.i18n.settingTab as any).basic.deleteDataBtnDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.button}
        settingKey="Button"
        settingValue={(plugin.i18n.settingTab as any).basic.deleteDataBtnText}
        on:clicked={() => {
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
    </Item>
  </Panel>
  <Panel display={panels[1].key === panel_focus}>
    <Tabs focus={template_tab_focus_key} tabs={template_tabs} let:focus>
      <!-- 标签页 1 内容 -->
      <div data-type={template_tabs[0].name} class:fn__none={template_tabs[0].key !== focus}>
        <!-- 多个配置的卡片 -->
        <Group title={(plugin.i18n.settingTab as any).templates.citeLink.citeTypeCardTitle}>
          {#each linkTemplatesGroup as linkItem, index }
            <MiniItem minWidth="200px">
              <span data-type="title" id={"linkItem_" + index} slot="title">{@html linkItem.name}</span>
              <div slot="input" style="display: flex;flex-direction:row" id={"linkItem_" + index}>
                <button
                  class="b3-tooltips b3-tooltips__nw block__icon block__icon--show"
                  data-type="setting"
                  aria-label={(plugin.i18n.settingTab as any).templates.citeLink.citeTypeCardSet}
                  on:click={clickCardSetting}
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
                  on:click={deleteLinkTemp}
                >
                  <Svg
                    icon="#iconTrashcan"
                    className="svg"
                  />
                </button>
              </div>
            </MiniItem>
          {/each}
          <Input
            block={false}
            normal={true}
            type={ItemType.button}
            settingKey="Button"
            settingValue={"添加"}
            on:clicked={() => {
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
            <Input
              slot="input"
              block={true}
              normal={true}
              type={ItemType.text}
              settingKey="Text"
              settingValue={citeName}
              placeholder="Input the citation link template"
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                citeName = event.detail.value;
                linkTemplatesGroup[settingIndex].name = citeName;
                linkTemplatesGroup = linkTemplatesGroup;
              }}
            />
          </Item>
          <!-- 引用链接模板 -->
          <Item
            block={true}
            title={(plugin.i18n.settingTab as any).templates.citeLink.linkTempInputTitle}
            text={(plugin.i18n.settingTab as any).templates.citeLink.linkTempInputDescription}
          >
            <Input
              slot="input"
              block={true}
              normal={true}
              type={ItemType.text}
              settingKey="Text"
              settingValue={linkTemplate}
              placeholder="Input the citation link template"
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                linkTemplate = event.detail.value;
                linkTemplatesGroup[settingIndex].linkTemplate = event.detail.value;
                linkTemplatesGroup = linkTemplatesGroup;
              }}
            />
          </Item>
          <!-- shortAuthor长度 -->
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).templates.citeLink.shortAuthorLimitTitle}
            text={(plugin.i18n.settingTab as any).templates.citeLink.shortAuthorLimitDescription}
          >
            <Input
              slot="input"
              block={false}
              normal={true}
              type={ItemType.number}
              settingKey="Text"
              settingValue={shortAuthorLimit}
              placeholder="Input the citation link template"
              limits={{min:1, max:10, step:1}}
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                shortAuthorLimit = event.detail.value;
                linkTemplatesGroup[settingIndex].shortAuthorLimit = event.detail.value;
                linkTemplatesGroup = linkTemplatesGroup;
              }}
            />
          </Item>
          <!-- 多文献引用设置 -->
          <label class="fn__flex b3-label">
            <div class="fn__flex-1">
                <slot name="title">{@html (plugin.i18n.settingTab as any).templates.citeLink.multiCiteTitle}</slot>
                <div class="b3-label__text">
                    <slot name="text">{@html (plugin.i18n.settingTab as any).templates.citeLink.multiCiteDescription}</slot>
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
                on:changed={(event) => {
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
                on:changed={(event) => {
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
                on:changed={(event) => {
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
            <Input
              slot="input"
              block={false}
              normal={true}
              type={ItemType.checkbox}
              settingKey="Checkbox"
              settingValue={customCiteText}
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                  );
                customCiteText = event.detail.value;
                linkTemplatesGroup[settingIndex].customCiteText = event.detail.value;
                linkTemplatesGroup = linkTemplatesGroup;
              }}
            />
          </Item>
          <!-- 是否使用动态锚文本-->
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).templates.citeLink.useDynamicRefLinkSwitchTitle}
            text={(plugin.i18n.settingTab as any).templates.citeLink.useDynamicRefLinkSwitchDescription}
          >
            <Input
              slot="input"
              block={false}
              normal={true}
              type={ItemType.checkbox}
              settingKey="Checkbox"
              settingValue={useDynamicRefLink}
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Checkbox changed: ${event.detail.key} = ${event.detail.value}`
                  );
                useDynamicRefLink = event.detail.value;
                linkTemplatesGroup[settingIndex].useDynamicRefLink = event.detail.value;
                linkTemplatesGroup = linkTemplatesGroup;
              }}
            />
          </Item>
          {#if customCiteText && useDynamicRefLink}
            <!-- 文献内容文档命名模板 -->
            <Item
              block={true}
              title={(plugin.i18n.settingTab as any).templates.citeLink.nameTempInputTitle}
              text={(plugin.i18n.settingTab as any).templates.citeLink.nameTempInputDescription}
            >
              <Input
                slot="input"
                block={true}
                normal={true}
                type={ItemType.text}
                settingKey="Text"
                settingValue={nameTemplate}
                placeholder="Input the literature note's name template"
                on:changed={(event) => {
                  if (isDev)
                    logger.info(
                      `Input changed: ${event.detail.key} = ${event.detail.value}`
                    );
                  nameTemplate = event.detail.value;
                  linkTemplatesGroup[settingIndex].nameTemplate = event.detail.value;
                  linkTemplatesGroup = linkTemplatesGroup;
                }}
              />
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
          <Input
            slot="input"
            block={true}
            normal={true}
            type={ItemType.text}
            settingKey="Text"
            settingValue={titleTemplate}
            placeholder="Input the title template"
            on:changed={(event) => {
              if (isDev)
                logger.info(
                  `Input changed: ${event.detail.key} = ${event.detail.value}`
                );
              titleTemplate = event.detail.value;
            }}
          />
        </Item>
        <!-- 刷新全部文档标题 -->
        <Item
          block={false}
          title={(plugin.i18n.settingTab as any).templates.literatureNote.refreshLiteratureNoteBtnTitle}
          text={(plugin.i18n.settingTab as any).templates.literatureNote.refreshLiteratureNoteBtnDesciption}
        >
          <Input
            slot="input"
            block={false}
            normal={true}
            type={ItemType.button}
            settingKey="Button"
            settingValue={(plugin.i18n.settingTab as any).templates.literatureNote.refreshLiteratureNoteBtnText}
            on:clicked={() => {
              if (isDev) logger.info("Button clicked");
              dispatcher("refresh literature note title", { titleTemplate });
            }}
          />
        </Item>
        <!-- 文献内容模板 -->
        <Item
          block={true}
          title={(plugin.i18n.settingTab as any).templates.literatureNote.noteTempTexareaTitle}
          text={(plugin.i18n.settingTab as any).templates.literatureNote.noteTempTexareaDescription}
        >
          <Input
            slot="input"
            block={true}
            normal={true}
            rows={10}
            type={ItemType.textarea}
            settingKey="Textarea"
            settingValue={noteTemplate}
            placeholder="Input the literature note template"
            on:changed={(event) => {
              if (isDev)
                logger.info(
                `Input changed: ${event.detail.key} = ${event.detail.value}`
                );
              noteTemplate = event.detail.value;
            }}
          />
        </Item>
      </div>

      <!-- 标签页 3 内容 -->
      <div data-type={template_tabs[2].name} class:fn__none={template_tabs[2].key !== focus}>
        <!-- 自定义用户数据标题 -->
        <Item
          block={true}
          title={(plugin.i18n.settingTab as any).templates.userData.titleUserDataInput}
          text={(plugin.i18n.settingTab as any).templates.userData.titleUserDataInputDescription}
        >
          <Input
            slot="input"
            block={true}
            normal={true}
            type={ItemType.text}
            settingKey="Text"
            settingValue={userDataTitle}
            placeholder="Input the 'User Data' title"
            on:changed={(event) => {
              if (isDev)
                logger.info(
                `Input changed: ${event.detail.key} = ${event.detail.value}`
              );
              userDataTitle = event.detail.value; 
            }}
          />
        </Item>
      </div>
    </Tabs>
  </Panel>

  <Panel display={panels[2].key === panel_focus}>
    <Tabs focus={debug_bridge_tab_focus_key} tabs={debug_bridge_tabs} let:focus>
      <!-- 标签页 1 内容 -->
      <div data-type={debug_bridge_tabs[0].name} class:fn__none={debug_bridge_tabs[0].key !== focus}>
        <!-- debug-bridge密码 -->
        <Item
          block={false}
          title={(plugin.i18n.settingTab as any).debug_bridge.plugin.dbPasswordInputTitle}
          text={(plugin.i18n.settingTab as any).debug_bridge.plugin.dbPasswordInputDescription}
        >
          <Input
            slot="input"
            block={false}
            normal={true}
            type={ItemType.text}
            settingKey="Text"
            settingValue={dbPassword}
            placeholder="Input debug-bridge password"
            on:changed={(event) => {
              if (isDev)
                logger.info(
                  `Input changed: ${event.detail.key} = ${event.detail.value}`
                );
              dbPassword = event.detail.value;
            }}
          />
        </Item>
        <!-- 使用的搜索面板 -->
        <Item
          block={false}
          title={(plugin.i18n.settingTab as any).debug_bridge.plugin.searchDialogSelectorTitle}
          text={(plugin.i18n.settingTab as any).debug_bridge.plugin.searchDialogSelectorDescription}
        >
          <Input
            slot="input"
            block={false}
            normal={true}
            type={ItemType.select}
            settingKey="Select"
            settingValue={dbSearchDialogType}
            options={dbSearchDialogOptions}
            on:changed={(event) => {
              if (isDev)
                logger.info(
                  `Select changed: ${event.detail.key} = ${event.detail.value}`
                );
              dbSearchDialogType = event.detail.value;
            }}
          />
        </Item>
      </div>

      <!-- 标签页 2 内容 -->
      <div data-type={debug_bridge_tabs[1].name} class:fn__none={debug_bridge_tabs[1].key !== focus}>
        {#if !isDebugBridge}
          <Item>
            <h3 slot="title">
              {(plugin.i18n.settingTab as any).debug_bridge.zotero.notAbleTitle}
            </h3>
            <span slot="text">
              {@html (plugin.i18n.settingTab as any).debug_bridge.zotero.notAbleDescription}
            </span>
          </Item>
        {:else}
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroLinkTitleTemplateTitle}
            text={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroLinkTitleTemplateDescription}
          >
            <Input
              slot="input"
              block={false}
              normal={true}
              type={ItemType.text}
              settingKey="Text"
              settingValue={zoteroLinkTitleTemplate}
              placeholder="Input the title"
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                zoteroLinkTitleTemplate = event.detail.value;
              }}
            />
          </Item>
          <Item
            block={false}
            title={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroTagTemplateTitle}
            text={(plugin.i18n.settingTab as any).debug_bridge.zotero.zoteroTagTemplateDescription}
          >
            <Input
              slot="input"
              block={false}
              normal={true}
              type={ItemType.text}
              settingKey="Text"
              settingValue={zoteroTagTemplate}
              placeholder="Input the tags"
              on:changed={(event) => {
                if (isDev)
                  logger.info(
                    `Input changed: ${event.detail.key} = ${event.detail.value}`
                  );
                  zoteroTagTemplate = event.detail.value;
              }}
            />
          </Item>
        {/if}
      </div>
    </Tabs>
  </Panel>
</Panels>
