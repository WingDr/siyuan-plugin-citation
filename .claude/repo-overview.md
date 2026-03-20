# 仓库结构与功能梳理

## 1. 项目定位

这是一个思源笔记插件，用于把文献管理器/文献文件中的条目接入到 SiYuan 中，完成：
- 检索文献
- 插入引用链接
- 生成/刷新文献笔记文档
- 同步 Zotero/Juris-M 元数据、批注、附件
- 导出带引用的 Markdown / Word / LaTeX
- 可选同步到思源数据库属性视图

插件入口与主生命周期在 [src/index.ts](../src/index.ts)。插件元信息在 [plugin.json](../plugin.json)，构建配置在 [webpack.config.js](../webpack.config.js)。

---

## 2. 顶层目录结构

### `src/`
核心源码目录。

- `index.ts`：插件入口，初始化数据库、引用管理、交互、导出、设置页等。
- `index.scss`：全局样式。
- `api/`：对 SiYuan 内核 API、网络请求并发管理的封装。
- `database/`：不同文献数据源的抽象与实现（本地文件 / Zotero BBT / Zotero debug-bridge）。
- `references/`：引用链接生成、邻接引用处理、文献笔记创建/刷新、文献池管理。
- `frontEnd/`：设置页、搜索面板、菜单交互、Svelte 组件。
- `events/`：事件总线和事件挂载。
- `export/`：导出 Markdown / Word / LaTeX。
- `utils/`：常量、模板、通知、快捷键、工具函数、日志等。
- `i18n/`：中英文文案。

### `zoteroJS/`
给 debug-bridge 模式下 Zotero/Juris-M 执行的 JS 脚本集合。用于读取条目、选中项、批注、附件、回写 URL/标签等。

### `scripts/`
Pandoc Lua filters：
- `citation.lua`
- `latex.lua`
- `math.lua`

用于 Word/LaTeX 导出过程中的引用与数学公式处理。

### `sample-data/`
示例文献数据：
- `sample.bib`
- `sample.json`

### `assets/`
README 和插件展示所用图片资源。

### 根目录配置文件
- `package.json`：依赖与脚本
- `plugin.json`：SiYuan 插件清单
- `webpack.config.js`：开发/生产构建与打包
- `tsconfig.json`：TypeScript 配置
- `.eslintrc.js`：ESLint 配置

---

## 3. 启动流程与核心对象

入口类：`SiYuanPluginCitation`，定义在 [src/index.ts:35-137](../src/index.ts#L35-L137)。

### `onload()` 初始化过程
见 [src/index.ts:55-96](../src/index.ts#L55-L96)：
1. 初始化 logger / noticer / literaturePool / networkManager
2. 读取本地存储设置 `STORAGE_NAME`
3. 注册引用图标与 LaTeX ref 图标
4. 执行版本升级逻辑 `changeUpdate`
5. 初始化 `KernelApi`
6. 初始化 `InteractionManager`
   - 自定义设置页
   - 注册命令
   - 注册 slash 菜单
   - 绑定事件总线
7. 初始化 `ExportManager`
8. 初始化 `Database`
9. 按设置中的数据库类型构建具体数据源
10. 初始化 `Reference`

### 主对象职责
- `Database`：文献数据源统一入口，负责搜索、取条目、插入引用/笔记、绑定文档。
- `Reference`：引用处理核心，负责生成引用内容、更新邻接引用、刷新文献笔记。
- `LiteraturePool`：维护 “文献 key ↔ 思源文档 id” 的映射。
- `InteractionManager`：注册 UI 入口、命令、右键菜单、粘贴事件。
- `ExportManager`：导出不同格式的文档。
- `KernelApi`：封装思源后端 API。

---

## 4. 功能总览

### 4.1 插入文献引用
实现入口：
- slash 菜单 [src/frontEnd/interaction.ts:77-93](../src/frontEnd/interaction.ts#L77-L93)
- 命令 [src/frontEnd/interaction.ts:156-168](../src/frontEnd/interaction.ts#L156-L168)
- 实际执行 [src/database/database.ts:76-80](../src/database/database.ts#L76-L80)

流程：
1. 从当前编辑器上下文中识别相邻引用（adjacent citations）
2. 打开检索面板或读取 Zotero 当前选中项
3. 生成引用链接文本
4. 插入到编辑器，并在需要时替换原有相邻引用组
5. 批量创建/刷新对应的文献笔记文档

邻接引用识别逻辑在 [src/references/reference.ts:57-126](../src/references/reference.ts#L57-L126)。
这是 README 里提到的“相邻引用一起编辑”的关键实现。

### 4.2 插入文献笔记
实现入口：
- slash 菜单 [src/frontEnd/interaction.ts:107-121](../src/frontEnd/interaction.ts#L107-L121)
- 命令 [src/frontEnd/interaction.ts:169-179](../src/frontEnd/interaction.ts#L169-L179)
- 实际执行 [src/database/database.ts:82-85](../src/database/database.ts#L82-L85)

底层通过数据源 `getCollectedNotesFromKey()` 取回 Zotero notes / 文件数据中的 note，并直接插入文档，不更新文献库。

### 4.3 引用 Zotero 当前选中条目
仅 debug-bridge 模式支持：
- slash 菜单 [src/frontEnd/interaction.ts:122-137](../src/frontEnd/interaction.ts#L122-L137)
- 命令 [src/frontEnd/interaction.ts:180-191](../src/frontEnd/interaction.ts#L180-L191)
- 逻辑 [src/database/database.ts:87-97](../src/database/database.ts#L87-L97)

通过数据源实现 `getSelectedItems()`，从 Zotero 中直接拉取当前选中项，再批量插入引用。

### 4.4 刷新数据库
命令入口 [src/frontEnd/interaction.ts:192-199](../src/frontEnd/interaction.ts#L192-L199)。

`Database.buildDatabase()` 会根据当前数据库类型重新实例化具体 modal，并重新加载本地文献映射 [src/database/database.ts:34-71](../src/database/database.ts#L34-L71)。

### 4.5 刷新全部/单篇文献笔记
- 单篇刷新命令 [src/frontEnd/interaction.ts:200-207](../src/frontEnd/interaction.ts#L200-L207)
- 全部刷新命令 [src/frontEnd/interaction.ts:208-214](../src/frontEnd/interaction.ts#L208-L214)

核心逻辑：
- 单篇刷新 [src/references/reference.ts:285-300](../src/references/reference.ts#L285-L300)
- 全部刷新 [src/references/reference.ts:273-283](../src/references/reference.ts#L273-L283)

### 4.6 检查失联文献
命令入口 [src/frontEnd/interaction.ts:215-220](../src/frontEnd/interaction.ts#L215-L220)。

实现见 [src/references/reference.ts:352-381](../src/references/reference.ts#L352-L381)：
- 遍历当前 library 文献文档
- 从数据源反查条目
- 若失联，则给文档标记 `custom-literature-unlinked=true`
- 并把标题改成带 `❌` 前缀

### 4.7 文档标题菜单能力
注册见 [src/frontEnd/interaction.ts:229-292](../src/frontEnd/interaction.ts#L229-L292)。

支持：
- Refresh Citations：刷新当前文档内所有引用链接 [src/frontEnd/interaction.ts:230-235](../src/frontEnd/interaction.ts#L230-L235)
- Refresh Literature Note Title：刷新当前文献笔记标题 [src/frontEnd/interaction.ts:237-243](../src/frontEnd/interaction.ts#L237-L243)
- Refresh Literature Note：刷新当前文献笔记内容 [src/frontEnd/interaction.ts:244-250](../src/frontEnd/interaction.ts#L244-L250)
- Export：导出文档 [src/frontEnd/interaction.ts:251-257](../src/frontEnd/interaction.ts#L251-L257)
- Bind to literature：将当前文档绑定到某篇文献 [src/frontEnd/interaction.ts:258-269](../src/frontEnd/interaction.ts#L258-L269)
- Unbind from literature：解除绑定 [src/frontEnd/interaction.ts:270-278](../src/frontEnd/interaction.ts#L270-L278)

### 4.8 右键切换引用样式
BlockRef 菜单入口 [src/frontEnd/interaction.ts:279-284](../src/frontEnd/interaction.ts#L279-L284)。

核心行为是对相邻引用整体重生成，逻辑在 `Reference.updateNeighborLinks()` [src/references/reference.ts:128-141](../src/references/reference.ts#L128-L141)。

### 4.9 从 Zotero 粘贴时自动替换/搬运图片
事件绑定见 [src/frontEnd/interaction.ts:364-369](../src/frontEnd/interaction.ts#L364-L369)。
粘贴处理入口见 [src/frontEnd/interaction.ts:378-399](../src/frontEnd/interaction.ts#L378-L399)。

当前代码显示：
- 仅 debug-bridge 模式支持
- 检测 Zotero 粘贴 HTML 中的 citation span
- 若启用 `autoReplace`，则拦截默认粘贴流程
- 同时还承担图片搬运逻辑

### 4.10 Protyle 工具栏中的 LaTeX 引用按钮
在 [src/index.ts:103-128](../src/index.ts#L103-L128)。

给编辑器工具栏添加：
- `ref`
- `eqref`

会把当前选中文本包装成：
- `[→文本](latex:\ref{文本})`
- `[⇒文本](latex:\eqref{文本})`

### 4.11 Slash 菜单插入 LaTeX 风格 callout 环境
在 [src/frontEnd/interaction.ts:64-65](../src/frontEnd/interaction.ts#L64-L65) 定义环境映射，
并在 [src/frontEnd/interaction.ts:139-155](../src/frontEnd/interaction.ts#L139-L155) 动态注册 slash 项。

支持 Assumption / Lemma / Theorem / Proposition / Corollary / Definition / Problem / Example / Remark。
插入的是思源 callout 风格块，例如：
`> [!THEOREM] Theorem`

### 4.12 导出 Markdown / Word / LaTeX
统一入口 [src/export/exportManager.ts:38-50](../src/export/exportManager.ts#L38-L50)。

#### Markdown 导出
实现 [src/export/exportManager.ts:53-95](../src/export/exportManager.ts#L53-L95)
- 临时修改思源导出配置
- 导出 Markdown 内容
- 把内部块引用替换为 `[@citekey]` 或 Zotero 选择 URI
- 生成并下载 `.md`

#### Word 导出
实现 [src/export/exportManager.ts:97-175](../src/export/exportManager.ts#L97-L175)
- 先导出 Markdown
- 邻接引用会合并成单个 cite 组 [src/export/exportManager.ts:117-139](../src/export/exportManager.ts#L117-L139)
- 写入临时 markdown
- 调用 pandoc + `scripts/citation.lua` + `scripts/math.lua`
- 输出 `.docx`

#### LaTeX 导出
实现 [src/export/exportManager.ts:177-250](../src/export/exportManager.ts#L177-L250)
- 将引用替换为 `\cite{...}`
- 邻接引用合并
- 调用 pandoc + `scripts/math.lua` + `scripts/latex.lua`
- 输出 `.tex`

注意：当前 LaTeX 导出里存在硬编码模板路径：
[src/export/exportManager.ts:229-237](../src/export/exportManager.ts#L229-L237)
其中 `--template` 指向本机绝对路径 `D:/Documents/OneDrive/杂项/模板/pandoc_template.tex`，这是仓库里很重要的实现细节，也意味着该功能当前有明显的本地环境耦合。

### 4.13 文献笔记绑定/合并
主逻辑在 [src/references/literatureNote.ts:94-161](../src/references/literatureNote.ts#L94-L161)。

能力包括：
- 把任意文档绑定成某篇文献的笔记文档
- 若该文献已有绑定文档，则迁移用户数据块与引用，再删除重复文档
- 使用 `custom-literature-key`、`custom-literature-unlinked`、`custom-literature-block-type` 等属性维护状态

### 4.14 同步思源数据库属性视图
逻辑在 [src/references/literatureNote.ts:216-259](../src/references/literatureNote.ts#L216-L259)。

会：
1. 根据设置找到属性视图块和 AV ID
2. 检查当前文献文档是否已绑定到该数据库
3. 若无则插入块
4. 根据模板生成 JSON
5. 调用内核接口批量写入属性

### 4.15 回写 Zotero 标签和反链
逻辑在 [src/references/literatureNote.ts:182-214](../src/references/literatureNote.ts#L182-L214)。

使用模板生成：
- backlink 标题和 URL
- tags

再通过 `Database.updateDataSourceItem()` 回写到数据源；该能力主要面向 debug-bridge/Zotero 模式。

---

## 5. 数据源架构

统一抽象基类：`DataModal`，定义于 [src/database/modal.ts:30-52](../src/database/modal.ts#L30-L52)。

统一接口包括：
- `buildModal()`
- `getContentFromKey()`
- `getCollectedNotesFromKey()`
- `showSearching()`
- `getTotalKeys()`
- 可选 `getSelectedItems()` / `updateDataSourceItem()` / `getAttachmentByItemKey()`

### 5.1 本地文件模式：`FilesModal`
实现见 [src/database/modal.ts:65-214](../src/database/modal.ts#L65-L214)。

特点：
- 从工作空间参考目录搜索 `.bib` / `.json` 文件
- 用 `@retorquere/bibtex-parser` 和 JSON.parse 载入条目
- 构造 `Library` 抽象
- 用 Fuse.js 构建全文检索索引 [src/database/modal.ts:77-108](../src/database/modal.ts#L77-L108)

### 5.2 Zotero Better BibTeX 模式：`ZoteroModal`
实现见 [src/database/modal.ts:234-351](../src/database/modal.ts#L234-L351)。

特点：
- 通过 `better-bibtex` 本地 HTTP / JSON-RPC 接口通信
- 使用 `cayw` 获取 citekeys
- 使用 `item.export` 拉取单条完整元数据
- 使用 `item.notes` 获取笔记
- 端口：Zotero `23119`，Juris-M `24119` [src/database/modal.ts:325-327](../src/database/modal.ts#L325-L327)

### 5.3 Zotero debug-bridge 模式：`ZoteroDBModal`
实现从 [src/database/modal.ts:362](../src/database/modal.ts#L362) 开始。

从目录结构和 README 可确认它是最强模式，支持：
- 更快搜索
- 直接读取 Zotero 选中项
- 读取附件、批注、note
- 回写 URL / 标签
- 导出 Word / LaTeX 时更完整联动

其 JS 脚本位于 [zoteroJS/](../zoteroJS/)：
- `getAllItems.ts`
- `getSelectedItems.ts`
- `getAttachmentByItemKey.ts`
- `getMarkdownNotes.ts`
- `addTagsToItem.ts`
- `updateURLToItem.ts`
等。

---

## 6. 引用与文献笔记的核心数据流

### 6.1 插入引用的数据流
1. 由命令/slash/menu 触发 `Database.insertCiteLink()` [src/database/database.ts:76-80](../src/database/database.ts#L76-L80)
2. 校验设置（笔记本、文献库路径）[src/database/database.ts:173-185](../src/database/database.ts#L173-L185)
3. 打开搜索面板，拿到选中文献 keys
4. 进入 `insertCiteLinkBySelection()` [src/database/database.ts:187-217](../src/database/database.ts#L187-L217)
5. 由 `Reference.processReferenceContents()`（定义在 `reference.ts` 后续部分）生成引用内容
6. `Reference.insertContent()` 将内容写入当前编辑器 [src/references/reference.ts:302-327](../src/references/reference.ts#L302-L327)
7. 同时批量创建/刷新文献文档，由 `LiteratureNote` 承接

### 6.2 文献笔记更新的数据流
核心在 [src/references/literatureNote.ts:71-92](../src/references/literatureNote.ts#L71-L92) 与 [src/references/literatureNote.ts:261-332](../src/references/literatureNote.ts#L261-L332)。

流程：
1. 根据 key 查找文献文档是否存在
2. 不存在则创建空文档并生成 user data 区域
3. 写入 entry-data、自定义属性
4. 探测 user data 区域
5. 只更新模板生成区，尽量保留用户数据区
6. 需要时同步 Zotero 标签/反链
7. 需要时同步属性视图

### 6.3 用户数据保护机制
逻辑核心在 [src/references/literatureNote.ts:334-399](../src/references/literatureNote.ts#L334-L399) 及其后续。

机制要点：
- 支持“整篇文档就是用户数据”或“标题以下是用户数据”两种模式
- 通过首块引用、`custom-literature-block-type="user data"`、标题块等信号识别用户区
- 在刷新时只删除模板生成区
- 若未识别到用户数据，可弹确认或按设置强制覆盖

这正对应 README 中对 “User Data” 区域的说明。

---

## 7. 模板系统

实现很简单，位于 [src/utils/templates.ts:1-7](../src/utils/templates.ts#L1-L7)。

行为：
- 把 `{{ expr }}` 转成 `template_js` 的 `<%= expr %>`
- 关闭 HTML escape
- 直接执行模板

因此模板能力实际上支持：
- 普通变量替换
- JS 表达式
- 条件判断/循环（通过 template.js / EJS 风格语法）

模板变量来源：
- 本地文件模式由 `Library.getTemplateVariablesForCitekey()` 提供 [src/database/filesLibrary.ts:52-89](../src/database/filesLibrary.ts#L52-L89)
- Zotero 模式由 `EntryZoteroAdapter` 及其适配函数提供 [src/database/zoteroLibrary.ts](../src/database/zoteroLibrary.ts)

重要模板用途：
- 文献标题模板
- 文献笔记内容模板
- 引用文字模板
- 文档命名模板
- Zotero 标签模板
- Zotero 反链标题模板
- 属性视图 JSON 模板

---

## 8. 前端/UI 结构

### 设置页
目录：`src/frontEnd/settingTab/`

包含：
- `settingTab.ts`
- `settingTabComponent.svelte`
- `panel/`、`tab/`、`item/` 等一组可复用设置 UI 组件

说明：设置页是一个自定义 Svelte 面板系统，不是简单拼接表单。这里集中承载插件的所有配置项，包括数据库类型、模板、导出参数、debug-bridge 选项、属性视图模板等。

### 检索弹窗
- 逻辑 [src/frontEnd/searchDialog/searchDialog.ts](../src/frontEnd/searchDialog/searchDialog.ts)
- UI [src/frontEnd/searchDialog/dialogComponent.svelte](../src/frontEnd/searchDialog/dialogComponent.svelte)

能力：
- 弹出对话框
- 搜索框输入
- 结果列表滚动与键盘定位
- 确认选中后回调

### 杂项组件
`src/frontEnd/misc/` 下有图标与 tooltip 等 Svelte 组件/工具。

---

## 9. 国际化

文案文件：
- [src/i18n/en_US.json](../src/i18n/en_US.json)
- [src/i18n/zh_CN.json](../src/i18n/zh_CN.json)

交互层里大量通过 `this.plugin.i18n.xxx` 引用文案，例如 slash 名称、菜单文字、通知、错误提示等。

---

## 10. 构建、开发与发布

### NPM 脚本
定义在 [package.json:5-9](../package.json#L5-L9)：
- `npm run lint`
- `npm run dev`
- `npm run build`

### 技术栈
见 [package.json](../package.json)：
- TypeScript
- Svelte 5
- Webpack
- esbuild-loader
- Sass
- Fuse.js
- axios
- template_js
- `@retorquere/bibtex-parser`

### Webpack 行为
见 [webpack.config.js:9-142](../webpack.config.js#L9-L142)：
- 开发模式输出到本地 SiYuan 插件目录 `D:/Documents/SiYuan/data/plugins/siyuan-plugin-citation/`
- 生产模式输出 `dist/`
- 自动复制 `README`、`plugin.json`、`i18n`、`assets`、`sample-data`、`zoteroJS`、`scripts`
- 生产模式额外打 `package.zip`

注意：当前构建配置强依赖作者本机目录，不是纯仓库内相对路径开发模式。

---

## 11. 仓库里值得注意的实现细节

### 11.1 文献 key 设计
很多地方使用 `libraryID_citekey` 或 `libraryID_itemKey` 形式作为内部 key，例如：
- 文件模式默认前缀 `1_` [src/database/filesLibrary.ts:246-248](../src/database/filesLibrary.ts#L246-L248)
- Zotero 模式根据 `useItemKey` 决定 key [src/database/zoteroLibrary.ts:163-166](../src/database/zoteroLibrary.ts#L163-L166)

### 11.2 相邻引用被视为一个编辑组
这是这个插件最核心的体验特征之一，体现在：
- 识别当前光标附近的引用 span [src/references/reference.ts:57-126](../src/references/reference.ts#L57-L126)
- 切换样式时整组重写 [src/references/reference.ts:128-141](../src/references/reference.ts#L128-L141)
- 导出时整组邻接引用合并 [src/export/exportManager.ts:269-285](../src/export/exportManager.ts#L269-L285)

### 11.3 引用和文献文档解耦但通过池映射关联
`LiteraturePool` 维护 key 和思源块 id 的关系。插入引用时，链接指向的是文献笔记文档；文献笔记内容则由条目元数据模板生成。

### 11.4 文献笔记不只是缓存，也是同步中枢
`LiteratureNote` 不只负责“生成一个文档”，还附带：
- 用户数据保护
- Zotero backlink/tag 回写
- SiYuan 属性视图同步
- 合并重复绑定文档

因此它是全插件最关键的状态同步中心之一。

### 11.5 debug-bridge 模式能力最完整
从 README、交互层条件判断和目录结构都能看出：
- 多数高级功能围绕 debug-bridge 展开
- 包括 Zotero 已选条目插入、批注、图片、回写、Word/LaTeX 导出联动

---

## 12. 建议后续阅读顺序

如果后续要继续维护这个仓库，推荐按这个顺序读：

1. [src/index.ts](../src/index.ts)
2. [src/frontEnd/interaction.ts](../src/frontEnd/interaction.ts)
3. [src/database/database.ts](../src/database/database.ts)
4. [src/database/modal.ts](../src/database/modal.ts)
5. [src/references/reference.ts](../src/references/reference.ts)
6. [src/references/literatureNote.ts](../src/references/literatureNote.ts)
7. [src/references/cite.ts](../src/references/cite.ts)
8. [src/export/exportManager.ts](../src/export/exportManager.ts)
9. `src/frontEnd/settingTab/` 整体
10. `zoteroJS/` 脚本目录

---

## 13. 一句话总结

这个仓库的本质是：**把文献数据源（BibTeX/CSL/Zotero）映射成 SiYuan 里的“可插入引用 + 可维护文献笔记 + 可导出引用格式”的完整工作流插件**，其中 `Reference + LiteratureNote + Database` 是核心三件套，`debug-bridge` 模式下功能最完整。
