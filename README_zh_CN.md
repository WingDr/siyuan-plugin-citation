[README English](https://github.com/WingDr/siyuan-plugin-citation/blob/main/README.md)

# Citation for SiYuan

> 一个只实现了基础功能的引用插件，希望你的思源~~更像obsidian~~更加学术



## 功能

在你的笔记中添加文献引用，该引用指向在你指定的文件夹下生成的文献内容，如下图所示：

![](./preview.png)

## 在使用前

- 在`[工作空间]/data/siyuan-plugin-citation/data/`文件夹下，放置任意数量的`csl-json`和`bibtex`文件，其中包含你所想要引用的文献。

- 在插件的设置面板中，选择你想要放置文献库的笔记本和文件夹路径。

- 在插件的设置面板中，自定义文献内容和引用的模板。

- 设置改完记得点`保存`

## 目前有什么功能

1. 添加引用：
   
   - 斜杠菜单
   
   - 命令面板/快捷键

2. 刷新文献库（当你的`.bib`或者`.json`文件更新了）：
   
   - 命令面板

![](./assets/protyleslash.png)

![](./assets/searchpanel.png)

## 怎么写模板

- 语法使用的是markdown语法

- 想要被变量替换的部分用`{{ }}`包裹，例如`{{title}}`

- 目前在文本框中按下`Enter`键就会保存，等更新

在文献内容和引用的模板中可以使用如下变量：

```markdown
- {{citekey}}
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
- {{zoteroSelectURI}}
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
  在`[工作空间]/data/siyuan-plugin-citation/data/`中提供了`sample.bib` 和 `sample.json` 用于参考，如果你使用的软件能够提供这样的导出，那么就可以使用
  ***注意！在`.bib`和`.json`文件中，每个文献的`citekey/id`必须是唯一的***

## TODO

- [ ] Zotero 集成 `长期`

- [ ] 导出支持LATEX `长期`

- [ ] 美化界面 `脑子要炸`

- [ ] 功能优化：
  
  - [ ] 更宽松的模板/路径格式限制 `多给我提issue`
  - [ ] 更好的 Template 处理 `好难写`
  - [ ] 命令面板中去掉无效功能 `等V姐更新`
  - [ ] 支持citation link中使用index `等V姐更新`
  - [ ] 适配移动端 `有没有大哥先试试`

## 感谢

参考了以下项目的代码，非常感谢

[sy-transfer-refs](https://github.com/frostime/sy-transfer-refs)

[obsidian-citation-plugin](https://github.com/hans/obsidian-citation-plugin)

[siyuan-plugin-importer](https://github.com/terwer/siyuan-plugin-importer)

## 赞助

> 咱就放个收款码在这，其实大家随便白嫖下就好了，多提issue看到更多人用才是对我最大的鼓励

![](./assets/weixin.jpg)

![](./assets/alipay.jpg)
