<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { showMessage, confirm } from "siyuan";

  import SiYuanPluginCitation from "../../index";
  import {
    STORAGE_NAME,
    hiddenNotebook,
    databaseType,
    defaultTitleTemplate,
    defaultNoteTemplate,
    defaultLinkTemplate,
    defaultReferencePath,
    defaultUserDataTile,
    isDev,
    dataDir,
    defaultDBPassword,
    dbSearchDialogTypes
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
  // Zotero模板设定变量
  let zoteroLinkTitleTemplate: string;
  let zoteroTagTemplate: string;
  // debug-bridge变量
  let dbPassword: string;
  let dbSearchDialogType: string;

  // 设定数据的默认值
  let defaultSettingData;

  let panel_focus_key = 1;
  const panels: IPanel[] = [
    {
      key: 1,
      text: plugin.i18n.settingTab.basic.title,
      name: "citation-setting-basic",
      icon: "#iconSettings",
    },
    {
      key: 2,
      text: plugin.i18n.settingTab.templates.title,
      name: "citation-setting-templates",
      icon: "#iconEdit",
    },
    {
      key: 3,
      text: plugin.i18n.settingTab.debug_bridge.title,
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
      text: plugin.i18n.settingTab.templates.siyuan.title,
      name: "citation-setting-template-siyuan",
      icon: "",
    },
    {
      key: 2,
      text: plugin.i18n.settingTab.templates.zotero.title,
      name: "citation-setting-template-zotero",
      icon: "",
    },
  ];

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
      (notebook) => !notebook.closed && !hiddenNotebook.has(notebook.name)
    );
    notebookOptions = notebooks.map((notebook) => {
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

    // 设置默认数据
    defaultSettingData = {
      referenceNotebook: notebooks[0].id,
      referencePath: defaultReferencePath,
      database: databaseType[0],
      titleTemplate: defaultTitleTemplate,
      userDataTitle: defaultUserDataTile,
      noteTemplate: defaultNoteTemplate,
      linkTemplate: defaultLinkTemplate,
      nameTemplate: "",
      customCiteText: false,
      useItemKey: false,
      autoReplace: false,
      deleteUserDataWithoutConfirm: false,
      useDynamicRefLink: false,
      zoteroLinkTitleTemplate: "",
      zoteroTagTemplate: "",
      dbPassword: defaultDBPassword,
      dbSearchDialogType: dbSearchDialogTypes[0]
    }
    // 默认笔记本为第一个打开的笔记本
    referenceNotebook = plugin.data[STORAGE_NAME]?.referenceNotebook ?? defaultSettingData.referenceNotebook;
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

    displayPanels = generatePanels(panels);
  }

  function _checkDebugBridge(dtype): boolean {
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
      dbSearchDialogType
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
  });
</script>

<Panels panels={displayPanels} focus={panel_focus_key} let:focus={panel_focus}>
  <Panel display={panels[0].key === panel_focus}>
    <Item>
      <h4 slot="title">
        {plugin.i18n.settingTab.settingTabTitle.replace(
          "${version}",
          pluginVersion
        )}
      </h4>
      <span slot="text">
        {@html plugin.i18n.settingTab.settingTabDescription
          .replaceAll("${e-mail}", eMail)
          .replace("${issuesURL}", issuesURL)}
      </span>
    </Item>

    <!-- 选择笔记本 -->
    <Item
      block={false}
      title={plugin.i18n.settingTab.basic.notebookSelectorTitle}
      text={plugin.i18n.settingTab.basic.databaseSelectorDescription}
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
      title={plugin.i18n.settingTab.basic.referencePathInputTitle}
      text={plugin.i18n.settingTab.basic.referencePathInputDescription}
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
      title={plugin.i18n.settingTab.basic.databaseSelectorTitle}
      text={plugin.i18n.settingTab.basic.databaseSelectorDescription}
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
        title={plugin.i18n.settingTab.basic.UseItemKeySwitchTitle}
        text={plugin.i18n.settingTab.basic.UseItemKeySwitchDescription}
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
      title={plugin.i18n.settingTab.basic.AutoReplaceSwitchTitle}
      text={plugin.i18n.settingTab.basic.AutoReplaceSwitchDescription}
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
      title={plugin.i18n.settingTab.basic.DeleteUserDataWithoutConfirmSwitchTitle}
      text={plugin.i18n.settingTab.basic.DeleteUserDataWithoutConfirmSwitchDescription}
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
      title={plugin.i18n.settingTab.basic.reloadBtnTitle}
      text={plugin.i18n.settingTab.basic.reloadBtnDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.button}
        settingKey="Button"
        settingValue={plugin.i18n.settingTab.basic.reloadBtnText}
        on:clicked={() => {
          if (isDev) logger.info("Button clicked");
          dispatcher("reload database", { database });
        }}
      />
    </Item>

    <!-- 删除数据 -->
    <Item
      block={false}
      title={plugin.i18n.settingTab.basic.deleteDataBtnTitle}
      text={plugin.i18n.settingTab.basic.deleteDataBtnDescription}
    >
      <Input
        slot="input"
        block={false}
        normal={true}
        type={ItemType.button}
        settingKey="Button"
        settingValue={plugin.i18n.settingTab.basic.deleteDataBtnText}
        on:clicked={() => {
          if (isDev) logger.info("Button clicked");
          confirm(
            "⚠️",
            plugin.i18n.settingTab.basic.confirmRemove.replace(
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
        <!-- 文档标题模板 -->
        <Item
          block={false}
          title={plugin.i18n.settingTab.templates.siyuan.titleTemplateInputTitle}
          text={plugin.i18n.settingTab.templates.siyuan.titleTemplateInputDescription}
        >
          <Input
            slot="input"
            block={false}
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
          title={plugin.i18n.settingTab.templates.siyuan.refreshLiteratureNoteBtnTitle}
          text={plugin.i18n.settingTab.templates.siyuan.refreshLiteratureNoteBtnDesciption}
        >
          <Input
            slot="input"
            block={false}
            normal={true}
            type={ItemType.button}
            settingKey="Button"
            settingValue={plugin.i18n.settingTab.templates.siyuan.refreshLiteratureNoteBtnText}
            on:clicked={() => {
              if (isDev) logger.info("Button clicked");
              dispatcher("refresh literature note title", { titleTemplate });
            }}
          />
        </Item>
        <!-- 自定义用户数据标题 -->
        <Item
          block={false}
          title={plugin.i18n.settingTab.templates.siyuan.titleUserDataInput}
          text={plugin.i18n.settingTab.templates.siyuan.titleUserDataInputDescription}
        >
          <Input
            slot="input"
            block={false}
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
        <!-- 文献内容模板 -->
        <Item
          block={true}
          title={plugin.i18n.settingTab.templates.siyuan.noteTempTexareaTitle}
          text={plugin.i18n.settingTab.templates.siyuan.noteTempTexareaDescription}
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
        <!-- 是否完全自定义引用 -->
        <Item
          block={false}
          title={plugin.i18n.settingTab.templates.siyuan.CustomCiteTextSwitchTitle}
          text={plugin.i18n.settingTab.templates.siyuan.CustomCiteTextSwitchDescription}
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
            }}
          />
        </Item>
        <!-- 引用链接模板 -->
        <Item
          block={false}
          title={plugin.i18n.settingTab.templates.siyuan.linkTempInputTitle}
          text={plugin.i18n.settingTab.templates.siyuan.linkTempInputDescription}
        >
          <Input
            slot="input"
            block={false}
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
            }}
          />
        </Item>
        <!-- 是否使用动态锚文本-->
        <Item
          block={false}
          title={plugin.i18n.settingTab.templates.siyuan.useDynamicRefLinkSwitchTitle}
          text={plugin.i18n.settingTab.templates.siyuan.useDynamicRefLinkSwitchDescription}
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
            }}
          />
        </Item>
        {#if customCiteText && useDynamicRefLink}
          <!-- 文献内容文档命名模板 -->
          <Item
            block={false}
            title={plugin.i18n.settingTab.templates.siyuan.nameTempInputTitle}
            text={plugin.i18n.settingTab.templates.siyuan.nameTempInputDescription}
          >
            <Input
              slot="input"
              block={false}
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
              }}
            />
          </Item>
        {/if}
      </div>

      <!-- 标签页 2 内容 -->
      <div data-type={template_tabs[1].name} class:fn__none={template_tabs[1].key !== focus}>
        {#if !isDebugBridge}
          <Item>
            <h3 slot="title">
              {plugin.i18n.settingTab.templates.zotero.notAbleTitle}
            </h3>
            <span slot="text">
              {@html plugin.i18n.settingTab.templates.zotero.notAbleDescription}
            </span>
          </Item>
        {:else}
          <Item
            block={false}
            title={plugin.i18n.settingTab.templates.zotero.zoteroLinkTitleTemplateTitle}
            text={plugin.i18n.settingTab.templates.zotero.zoteroLinkTitleTemplateDescription}
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
            title={plugin.i18n.settingTab.templates.zotero.zoteroTagTemplateTitle}
            text={plugin.i18n.settingTab.templates.zotero.zoteroTagTemplateDescription}
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

  <Panel display={panels[2].key === panel_focus}>
    <Item
      block={false}
      title={plugin.i18n.settingTab.debug_bridge.dbPasswordInputTitle}
      text={plugin.i18n.settingTab.debug_bridge.dbPasswordInputDescription}
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
    <Item
      block={false}
      title={plugin.i18n.settingTab.debug_bridge.searchDialogSelectorTitle}
      text={plugin.i18n.settingTab.debug_bridge.searchDialogSelectorDescription}
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
  </Panel>
</Panels>
