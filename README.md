[中文 README](https://github.com/WingDr/siyuan-plugin-citation/blob/main/README_zh_CN.md)

# Citation for SiYuan

## Functions

Add citations to your note, which point to the literature note in specific directrory.

![](./preview.png)

## Before usage

* Put any number of `csl-json` and `bibtex`  files in `[workspace]/data/storage/petal/siyuan-plugin-citation/references/`

* In the setting tab of this plugin, select the notebook and directory where you want put the literature note

* In the setting tab of this plugin, set up your own template for both the citation and the content of literature notes

* Remember to click `save` after change the setting

## 目前有什么功能

1. add citation：
   
   * slash menu
   
   * command panel / shortcut

2. refresh library (after update you`.bib` or `.json` files）：
   
   * command panel

![](./assets/protyleslash.png)

![](./assets/searchpanel.png)

## How to write templates

* use `Markdown` language

* Wrap the variables with `{{ }}`, such as `{{title}}`

* In this version of editor, do not press `Enter`  when edting the textarea!

you can use following variables in the templates:

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

Additionaly, you can use following variable in citation link:

```markdown
- {{shortAuthor}}
```

It will generate the author string in IEEE format like `Lin and Morse et al.`

## How to get `bibtex` or `CSL-JSON` file

* If you are using `Zotero`: 
  Use`Better BibTatex` plugin and export the library in `Better BibLaTex` or `Better CSL JSON`.

* If you are using other reference managers: 
  There are `sample.bib` and `sample.json` in `[workspace]/data/siyuan-plugin-citation/sample-data/` for refering.
  ***Caution! the `citekey/id` in `.bib` or `.json` file must be GLOBALLY UNIQUE!***

## TODO

* [ ] Zotero integration

* [ ] exportation support LATEX

* [ ] Better UI

* [ ] Function enhancing
  
  * [ ] More relax template restriction
  * [ ] Better template processing
  * [ ] Delete invalid function in command panel `wait for update`
  * [ ] Support `index` in citation
  * [ ] Support mobile frontend

## Acknowledgement

[sy-transfer-refs](https://github.com/frostime/sy-transfer-refs)

[obsidian-citation-plugin](https://github.com/hans/obsidian-citation-plugin)

[siyuan-plugin-importer](https://github.com/terwer/siyuan-plugin-importer)

## Sponsor

![](.//assets/weixin.jpg)

![](./assets/alipay.jpg)
