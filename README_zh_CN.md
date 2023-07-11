[README English](https://github.com/WingDr/siyuan-plugin-citation/blob/main/README.md)

# Citation for SiYuan

> 一个只实现了基础功能的引用插件，希望你的思源~~更像 obsidian~~更加学术

**参考[ttChen](https://getquicker.net/User/Actions/395924-ttChen)的建议，在之后的几个版本内将会实装使用[debug-brige](https://github.com/retorquere/zotero-better-bibtex/releases/download/debug-bridge/debug-bridge-6.7.79.emile.limonia.xpi)插件访问Zotero的功能，相对于现在版本使用better-bibtex的方法，这种方式的访问速度更快，效率更高，并且可以实现很多额外的功能（详见[大佬的quicker动作](https://getquicker.net/User/Actions/395924-ttChen)，在思源或者zotero上的功能之后都有可能实装在该插件中），使用Zotero/Juris-M数据库的用户可以提前做好准备，具体的准备方法参考[Run Javascript in Zotero](https://www.yuque.com/chentaotao-cf9fr/gthfy4/clqahv57w5ugmdev)**

**感谢[Geo123abc](https://github.com/Geo123abc)制作的[教学视频](https://www.bilibili.com/video/BV17u411j79z/?vd_source=b4b4ca14b1a866918dcef4ca52896f03)**

**在0.0.6版本中，扩展了模板处理的方法，加入了模板引擎[template.js](https://github.com/yanhaijing/template.js)，此前使用的模板在之后的版本中仍然可以使用，如果想要使用更高级的模板写法，请参考[模板的高级写法](#模板的高级写法)**

**在0.05版本中，文献库中文档的索引方式由文档标题变更为文档命名，更新后第一次启动插件时将会自动为未命名的文献内容文档更新命名，随后请重新启动思源，确保右上角提示中的文献引用数量与文献库中的文档数量一致。文档的标题新建时将被设定为文献的citekey，后续可以随意更改，但是请不要在文档属性中更改文档命名**

**在0.04版本中，设置面板增加了“自定义引用”的开关，如果你不是对正则表达式查找和思源引用逻辑有了解的资深用户，请不要打开它**

**在思源2.9.4版本中，已经可以在设置面板的“文献内容模板”中使用Shift/Ctrl+Enter换行了**

## 功能

在笔记中添加文献引用，该引用指向在你指定的文件夹下生成的文献内容，如下图所示：

![ ](./preview.png)

## 名词说明

1. **笔记本**：即思源笔记文档树中的笔记本，文献库只能放置在其中一个已经打开的笔记本中，如果切换文献库所在笔记本那么原本笔记本中的文献库将失效。
2. **数据库**：文献的原始数据来源，目前支持数据文件（BibTex和CSL-JSON）、Zotero和Juris-M三种数据来源。其中数据文件在每次启动软件时都会重新导入，但是如果在使用中文件本身产生变化，需要【重新载入数据库】（通过设置面板或命令）或者【重启思源软件】才能生效。
3. **文献库**：存放已经插入引用连接的文献内容的位置，本质上是一个*处于特定路径的文档*，它的子文档为所有引用过的文献内容，该文档本身的内容不会被修改，但是在插入引用时会增添和刷新它的子文档。
4. **文献内容**：根据文献的原始数据和设置界面填写的“*文献内容模板*”生成的文档，*新建文档的标题和命名为该文献的citekey*。目前该文档的内容在每次引用对应文献时都会刷新，因此 ***请不要在其中放置个人内容，也不要在文档属性修改文档的命名***，但是文档标题在用户修改后不会刷新。后续版本有支持用户自定义片段的计划。
5. **引用链接**：在文档中插入（也可以选择直接复制到剪贴板）的引用链接，该链接指向文献库中对应的文献内容，其锚文本为通过文献原始数据和设置界面填写的“*引用模板*”生成的文本。

## 使用前准备

### 对插件进行设置
1. 进入设置界面：点击`设置-集市-已下载-文献引用`插件开关旁边的齿轮按钮进入设置界面，也可以通过在顶栏插件按钮点击后的菜单中点击`文献引用`直接进入插件的设置界面。
2. 选择存放[文献内容](#名词说明)的[笔记本](#名词说明)：只能下拉选择已经在文档树中打开的笔记本，如果之前设置的笔记本本次启动未打开，那么将无法使用本插件。
3. 填写[文献库](#名词说明)路径：路径以`/`开头，例如`/References`或者`/Assets/References`，注意该路径本质上为文档所在路径，不要在最后加`/`。**注意：如果更换了文献库的路径，之前路径上的文献库将失效。此外，请确保该文档存在，因为[本插件不会自动创建文献库文档](#文献库路径不存在)**
4. 选择[数据库](#名词说明)类型：选择使用的数据库的类型，如果使用数据文件请参考[使用数据文件作为文献数据来源](#如果你使用bibtex和csl-json文件作为文献数据的来源)，如果使用Zotero或者Juris-M请参考[使用Zotero或者Juris-M作为文献数据来源](#如果你使用zotero或者juris-m作为文献数据的来源)。
5. 填写[文献内容文档标题]模板：填写生成文献内容文档的标题模板，模板的具体写法参考[模板写法](#怎么写模板)。
6. 填写[文献内容](#名词说明)模板：填写生成文献内容文档的文本内容模板，模板的具体写法参考[模板写法](#怎么写模板)。
7. 如果你认为你是对正则表达式查找和思源引用逻辑有了解的资深用户，并且想要兼容思源外的工作流，可以选择打开`自定义引用`的开关，打开该开关的具体效果详见[如果我打开了“自定义引用”的开关]()
8. 填写[引用链接](#名词说明)模板：填写生成引用链接锚文本的模板，模板的具体写法参考[模板写法](#怎么写模板)。
9. 如果你希望重新设计你的模板和数据，或者希望看到插件作者设置的默认设置，可以通过[删除数据](#点击“删除数据”后会发生什么)按钮将保存的设置数据全部删除。
10. 点击`保存`储存并应用设置。
11. 重启思源笔记（如果是在托盘区，也要完全退出来），重启之后如果设置没有生效，或者更新插件之后版本不对，请再次重启一至两次，有可能可以解决，但是目前不排除还有bug。

### 如果你使用BibTex和CSL-JSON文件作为文献数据来源

- 在`[工作空间]/data/storage/petal/siyuan-plugin-citation/references/`文件夹下，放置任意数量的`csl-json`和`bibtex`文件，其中包含你所想要引用的文献，文件的获取方法参考[如何获得文献数据文件](#如何获得bibtex或者csl-json文件)。
- 在插件的设置面板中，数据库类型处选择`BibTex and CSL-JSON`。

### 如果你使用Zotero或者Juris-M作为文献数据来源

- **确保你的 Zotero 或者 Juris-M 中安装了 [Better BibTex](https://github.com/retorquere/zotero-better-bibtex) 插件。**
- 在插件的设置面板中，数据库类型处选择`Zotero`或者`Juris-M`。
- 在使用前确保你的 Zotero 或者 Juris-M 是打开的。

## 我该怎么使用这个插件


## 目前有什么功能

- 斜杠菜单：
  - 插入文献引用：弹出文献搜索面板，选中文献后在光标位置插入该文献的[引用链接](#名词说明)，并更新文献库。

    通过输入“插入文献引用”、“addcitation”、“charuwenxianyinyong”都可以在斜杠菜单中索引到这个选项

  - 插入文献笔记：弹出文献搜索面板，选中文献后在光标位置插入该文献的笔记（该操作不更新文献库）。【相当于将Zotero/Juris-M中的笔记复制并插入到当前光标位置】

    通过输入“插入文献笔记”、“addliteraturenotes”、“charuwenxianbiji”都可以在斜杠菜单中索引到这个选项

- 命令（可以在`顶栏插件按钮-命令面板`直接搜索选中，或者在`设置-快捷键-插件-文献引用`中设置快捷键使用）：
  - 重新载入数据库：重新根据文献的来源载入[数据库](#名词说明)，同时也会重新索引[文献库](#名词说明)。
  - 刷新所有文献内容文档标题：根据当前设置的[标题模板](#使用前准备)，刷新[文献库](#名词说明)中所有文献内容文档的标题。
  - 复制文献引用：弹出文献搜索面板，选中文献后将该文献的[引用链接](#名词说明)复制到剪贴板，并更新文献库。
- 标题块图标菜单：
  - 刷新引用：使用当前的[引用链接模板](#对插件进行设置)刷新当前文档的全部（**在当前设置的[文献库](#名词说明)中有存放[文献内容](#名词说明)**）的引用链接的锚文本。当引用链接模板有变化时，可以通过该功能刷新文档内全部的引用链接格式。

![ ](./assets/protyleslash.png)

![ ](./assets/setcommand.png)

![ ](./assets/commandpanel.png)

![ ](./assets/titleIconMenu.jpg)

![ ](./assets/searchpanel.png)

![ ](./assets/zoteroIntegration.png)

## 怎么写模板

- 模板文本语法使用的是 Markdown 语法。

- 想要被变量替换的部分用`{{ }}`包裹，例如`{{title}}`。

- 在[文献内容模板](#对插件进行设置)输入框中可以使用`Shift/Ctrl + Enter`换行，和用`Tab`输入制表符。

在文献内容和引用的模板中可以使用如下变量：

```markdown
- {{citekey}}：文献的唯一标识，建议用zotero的better biblatex插件生成
- {{abstract}}：摘要
- {{authorString}}：所有作者按顺序排列的字符串
- {{containerTitle}}：文献所在刊物（论文集、期刊等）标题
- {{DOI}}：文献的DOI
- {{eprint}}：预印本
- {{eprinttype}}：预印本类型
- {{eventPlace}}：（会议等）地点
- {{page}}：页码
- {{publisher}}：出版商
- {{publisherPlace}}：出版商所在地
- {{tags}}: 所有的标签，以", "连接，CSL-JSON文件中没有此变量
- {{title}}：标题
- {{titleShort}}：简写标题，很多文献不存在简写标题
- {{type}}：文献的类型（注意：直接从zotero获取的和导出后再获取的文献类型标识可能不一样）
- {{URL}}：文献的访问网址
- {{year}}：文献的发表年份
- {{files}}：文献的附件
- {{zoteroSelectURI}}：可以直接跳转到Zotero对应的条目
- {{note}}：在Zotero中做的笔记，其中的链接支持直接跳转到Zotero
```

此外，在引用链接中还可以使用下面的变量：

```markdown
- {{shortAuthor}}：按照IEEE格式（大概）生成较短的作者字符串，例如`Lin and Morse et al.`
- {{citeFileID}}：文献内容文档在思源内部的ID，用于辅助生成引用链接或者外链，例如 `20230707192208-ocs4482`
```

### 模板的高级写法

在0.0.6版本中，模板处理部分使用了[template.js](https://github.com/yanhaijing/template.js)，为了适配一般用户的模板语法，在进行变量计算和替换之前，会将所有的`{{ }}`替换为`<%= %>`以供 template.js 进行模板处理。因此，除了使用旧有的`{{变量}}`语法外，还可以有很多高级的使用方法：

1. 在`{{ }}`中包裹`JavaScript`语句
2. 使用 template.js 原生语法（可以参考 [EJS 语法](https://ejs.bootcss.com/#docs)）

例如如下模板，就可以在条目没有变量`{{tags}}`时让本行不出现`**Tags**:`：

```JavaScript
{{ tags.length ? `\n**Tags**:\t\t${tags}` : "" }}
```

而如下模板能够让 Files 这一栏在没有附属的文件时不在生成：

```JavaScript
<% if (files.length) { %>
# Files

{{files}}
<% } %>
```

这一段模板和下面这一段模板有同样效果：

```Javascript
<% if (fileList.length) { %>
# Files

{{fileList.map(file => {if (file.type === "pdf") return `[[Open]](${file.zoteroOpenURI})\t|\t[${file.fileName}](file.path)`; else return `[[Locate]](${file.zoteroSelectURI})\t|\t[${file.fileName}](file.path)`;}).join("\n")}}
<% } %>
```

**注意：**所有变量返回的都是字符串，而不会直接返回`null`，所以请根据`.length`判断变量是否存在。

## 如何获得`BibTex`或者`CSL-JSON`文件

- 如果你使用`Zotero`：
  
  使用`Better BibLatex` 插件，以`Better BibLaTex`或者`Better CSL JSON`的格式导出文献库（同时可以选择`Keep Update`以便在修改Zotero中的条目后能够及时应用在思源中）

- 如果你使用的其它文献管理软件：
  
  在`[工作空间]/data/siyuan-plugin-citation/sample-data/`中提供了`sample.bib` 和 `sample.json` 用于参考，如果你使用的软件能够提供这样的导出，那么就可以使用

  ***注意！在`.bib`和`.json`文件中，每个文献的`citekey/id`必须是唯一的***

## 打开“自定义引用”的开关后会发生什么

[引用链接模板](#对插件进行设置)将变为完全自定义引用的格式，即引用链接模板生成的内容不再为锚文本，而是将**直接插入文档**。此时，为了避免对用户自身内容的影响，插件的刷新引用功能将**不会对链接（即双括号）外的部分进行维护**。

**查找引用链接的正则表达式为 /\\(\\((.\*?)\\\"(.\*?)\\\"\\)\\)/g ，请据此把握好您的模板格式**

⚠️**注意：开关开启后请确保你的模板中包含`...(( {{citeFileID}} "..."))...`否则生成的链接将无法引用**

## 点击“删除数据”后会发生什么

“删除数据”按钮会将设置界面填写保存的所有数据都删除，并将其**还原为插件作者所设置的初始值**。

**注意**：该功能**不会**导致`.bib`和`.json`文件被删除！

## 常见错误类型

### 未选择笔记本

请检查设置面板中[笔记本](#对插件进行设置)选项是否为空白。文献库必须位于已经打开的笔记本中，否则本插件将无法使用。如果文献库所在的笔记本被关闭，则需要重新设定文献库所在笔记本和路径。

### 文献库路径不存在

请检查[文献库](#名词说明)文档是否存在。由于不希望用户在无意间打乱自身的文档层级安排，因此本插件不会自动在文档树中新建文档，当文献库文档不存在时，将无法使用本插件的功能。

新建相关文档之后，需要[重新载入数据库](#目前有什么功能)。虽然理论上没有必要，但是**强烈建议重新启动思源笔记**，以保证文献库路径生效

### Zotero/Juris-M 没有在运行

请检查您的 Zotero/Juris-M 的打开状态，以及在 Zotero/Juris-M 中是否安装了 [Better BibTex](https://github.com/retorquere/zotero-better-bibtex) 插件，本插件依赖于该插件运行，目前有不依赖该插件[直接访问zotero.sqlite](#todo)的计划。

### 这些问题都不是

欢迎到本插件的github仓库上提[issue](https://github.com/WingDr/siyuan-plugin-citation/issues)

## TODO

- [x] Zotero 集成 `长期`
- [ ] 支持文献内容中的用户自定义片段 `大概下个版本`
- [ ] 支持复制出带有引用的markdown文本 `大概下个版本`
- [ ] 支持直接访问zotero.sqlite， 参考[obsidian-zotero](https://github.com/PKM-er/obsidian-zotero) `长期（真的很难）`
- [ ] 导出支持Word `长期`
- [ ] 导出支持 LATEX `长期`
- [ ] 支持公式引用和自动编号 `长期`
- [ ] 支持添加 Remark, Lemma 等 LATEX 定义块 `长期`
- [ ] 美化界面 `脑子要炸`
- [ ] 功能优化：
  - [ ] 更宽松的模板/路径格式限制 `多给我提issue`
  - [ ] 更好的 Template 处理 `好难写`
  - [ ] 命令面板中去掉无效功能 `等V姐更新`
  - [ ] 支持 citation link 中使用 index `等V姐更新`
  - [ ] 适配移动端 `有没有大哥先试试`

## 感谢

参考了以下项目的代码，非常感谢

[sy-transfer-refs](https://github.com/frostime/sy-transfer-refs)

[obsidian-citation-plugin](https://github.com/hans/obsidian-citation-plugin)

[siyuan-plugin-importer](https://github.com/terwer/siyuan-plugin-importer)

[obsidian-zotero-integration](https://github.com/mgmeyers/obsidian-zotero-integration)

[template.js](https://github.com/yanhaijing/template.js)

感谢 “思源笔记折腾群”的大伙给我答疑解惑
感谢[Geo123abc](https://github.com/Geo123abc)提供的资料和参考建议，以及相关的测试支持

## 赞助

> 咱就放个收款码在这，其实大家随便白嫖下就好了，多提 issue 看到更多人用才是对我最大的鼓励

![ ](./assets/weixin.jpg)

![ ](./assets/alipay.jpg)
