[README English](https://github.com/WingDr/siyuan-plugin-citation/blob/main/README.md)

# Citation for SiYuan

> 一个只实现了基础功能的引用插件，希望你的思源~~更像 obsidian ~~更加学术

**使用0.0.1版本的用户，请将你的.bib和.json文件移动到`[工作空间]/data/storage/petal/siyuan-plugin-citation/references/`中，新版本已经更换了储存的位置**

**目前已经支持集成 Zotero ，可以直接从 Zotero 或者 Juris-M 中获取文献了！**

## 功能

在你的笔记中添加文献引用，该引用指向在你指定的文件夹下生成的文献内容，如下图所示：

![ ](./preview.png)

## 在使用前

- 在插件的设置面板中，选择你想要放置文献库的笔记本和文件夹路径：
1. `笔记本`：对应着思源笔记文档树中的笔记本，只能下拉选择，假设我选择了一个名叫“文献阅读”的笔记本；
2. 鼠标悬浮在思源笔记文档树“文献阅读”的笔记本上，出现三个点和一个加号，点击加号，新建子文档，这个子文档命名成任何名字，不过尽量和其它同级别的子文档名字不一样，比如“MyReferences”。目前目录树的部分结构是：“文献阅读”→ “MyReferences”（注意真实名字中没有双引号）；
3. `文献库路径`：路径以“/”开头，例如“/References”，因为我前面设置中是“MyReferences”，所以此处我填写的是“/MyReferences”（注意，不要双引号）；
4. 如果在步骤2中是多层目录（个人不建议），比如：“文献阅读”→ “大学文献”→“MyReferences”，那么在步骤3中填写应该是“/大学文献/MyReferences”（注意，不要双引号），依次类推，（可以考虑基于某篇文献新建一个路径，但是不建议）。

- 在插件的设置面板中，自定义文献内容和引用的模板。

- 设置改完记得点`保存`

### 如果你使用BibTex文件和CSL-JSON文件作为文献库

- 在`[工作空间]/data/storage/petal/siyuan-plugin-citation/references/`文件夹下，放置任意数量的`csl-json`和`bibtex`文件，其中包含你所想要引用的文献。
- 在插件的设置面板中，数据库类型处选择`BibTex and CSL-JSON`。

### 如果你使用Zotero或者Juris-M作为文献库

- 确保你的 Zotero 或者 Juris-M 中安装了 [Better BibTex](https://github.com/retorquere/zotero-better-bibtex) 插件。
- 在插件的设置面板中，数据库类型处选择`Zotero`或者`Juris-M`。

## 目前有什么功能

1. 添加引用：

   - 斜杠菜单

2. 刷新文献库（当你的`.bib`或者`.json`文件更新了）：

   - 命令面板

![ ](./assets/protyleslash.png)

![ ](./assets/searchpanel.png)

![ ](./assets/zoteroIntegration.png)

## 怎么写模板

- 语法使用的是 Markdown 语法

- 想要被变量替换的部分用`{{ }}`包裹，例如`{{title}}`

- 目前在文本框中按下`Enter`键就会保存，尽量在外部写好复制进去，等更新

在文献内容和引用的模板中可以使用如下变量：

```markdown
- {{citekey}}：文献的唯一标识，建议用zotero的better biblatex插件生成
- {{abstract}}
- {{authorString}}
- {{containerTitle}}
- {{DOI}}
- {{eprint}}
- {{eprinttype}}
- {{eventPlace}}
- {{page}}
- {{publisher}}
- {{publisherPlace}}
- {{title}}
- {{titleShort}}
- {{URL}}
- {{year}}
- {{files}}
- {{zoteroSelectURI}}：可以直接跳转到Zotero对应的条目
- {{note}}：在Zotero中做的笔记，其中的链接支持直接跳转到Zotero
```

此外，在引用中还可以使用下面的变量：

```markdown
- {{shortAuthor}}
```

它会按照IEEE格式（大概）生成较短的作者字符串，例如`Lin and Morse et al.`

## 如何获得`bibtex`或者`CSL-JSON`文件

- 如果你使用`Zotero`：
  使用`Better BibTatex` 插件，以`Better BibLaTex`或者`Better CSL JSON`的格式导出文献库（同时可以选择`Keep Update`）

- 如果你使用的其它文献管理软件：
  在`[工作空间]/data/siyuan-plugin-citation/sample-data/`中提供了`sample.bib` 和 `sample.json` 用于参考，如果你使用的软件能够提供这样的导出，那么就可以使用
  ***注意！在`.bib`和`.json`文件中，每个文献的`citekey/id`必须是唯一的***

## TODO

- [x] Zotero 集成 `长期`

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

## 赞助

> 咱就放个收款码在这，其实大家随便白嫖下就好了，多提 issue 看到更多人用才是对我最大的鼓励

![ ](./assets/weixin.jpg)

![ ](./assets/alipay.jpg)
