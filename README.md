[中文 README](https://github.com/WingDr/siyuan-plugin-citation/blob/main/README_zh_CN.md)

# Citation for SiYuan

> A citation plugin that implements basic functionality, hoping to make your SiYuan more academically oriented.

**Based on the suggestion from [ttChen](https://getquicker.net/User/Actions/395924-ttChen), in the upcoming versions, the functionality of accessing Zotero using the [debug-bridge](https://github.com/retorquere/zotero-better-bibtex/releases/download/debug-bridge/debug-bridge-6.7.79.emile.limonia.xpi) plugin will be implemented. This method offers faster access speed and higher efficiency compared to the current method of using Better BibTeX. Additionally, it enables the implementation of many additional features (refer to [ttChen's Quicker action](https://getquicker.net/User/Actions/395924-ttChen) for details). Users who use Zotero/Juris-M databases should prepare in advance. For specific preparation methods, please refer to [Run Javascript in Zotero](https://www.yuque.com/chentaotao-cf9fr/gthfy4/clqahv57w5ugmdev).**

**Special thanks to [Geo123abc](https://github.com/Geo123abc) for creating the [tutorial video](https://www.bilibili.com/video/BV17u411j79z/?vd_source=b4b4ca14b1a866918dcef4ca52896f03).**

**In version 0.0.6, the template handling method has been expanded by incorporating the template engine template.js. The templates used previously can still be used in subsequent versions. If you want to use more advanced template syntax, please refer to [Advanced Template Syntax](#advanced-template-syntax).**

**In version 0.05, the indexing method of documents in the literature library has been changed from document titles to document names. After updating, the plugin will automatically update the names of unnamed literature note documents during the first startup. Please restart SiYuan afterwards to ensure that the literature notes count in the top right corner matches the number of documents in the library. When a document is created, its title will be set as the literature's citekey, and it can be changed later as desired. However, please do not change the document name in the document properties.**

**In version 0.04, a switch for "Customize Citation Link" has been added to the settings tab. If you are not an experienced user familiar with regular expression searching and SiYuan reference logic, please do not enable it.**

**In SiYuan version 2.9.4, you can use `Shift/Ctrl+Enter` to create line breaks in the "Literature Note Template" in the settings panel.**

## Features

Add citations to your notes, which refer to literature note generated in a specified folder, as shown in the following image:

![ ](./preview.png)

## Glossary

1. **Notebook**: Refers to a notebook in the SiYuan note document tree. The library can only be placed in one of the open notebooks. If you switch to another notebook for the library, the previously selected notebook's library will become invalid.
2. **Database**: The original data source of the literature, currently supports three types: data files (BibTeX and CSL-JSON), Zotero, and Juris-M. The data files are reimported every time the software is launched, but if the files themselves change during use, you need to **"Reload the Database"** (through the settings panel or command) or **"Restart the SiYuan software"** for the changes to take effect.
3. **Library**: The location where the inserted citation links point to the literature note. It is essentially a *document located at a specific path*. Its sub-documents are all literature note that has been referenced. The content of this document itself will not be modified, but it will be updated and refreshed when citations are inserted.
4. **Literature Note**: A document generated based on the original data of a literature entry and the "*Literature Note Template*" filled in the settings interface. The title and naming of a newly created document are set to the citekey of that literature entry. Currently, the content of this document is refreshed every time the corresponding literature is cited. Therefore, **do not modify the document's naming in the document properties**. The literature note now supports a user data section, as explained in the [Explaining Literature Note](#explaining-literature-note) section. **Please refrain from inserting personal content in areas other than the user data section**.
5. **Citation Link**: The reference link inserted in the document (or copied to the clipboard), which points to the corresponding literature note in the library. The anchor text of the link is generated based on the literature's original data and the "Citation Link Template" filled in the settings panel.

## Preparation before Use

### Configure the Plugin

1. Go to the settings panel: Click on the gear icon next to the `Citation for SiYuan` plugin switch in `Settings - Marketplace - Downloaded` to enter the settings panel. Alternatively, you can directly enter the plugin's settings panel by clicking on "Citation for SiYuan" in the plugin menu after clicking on the top toolbar's plugin button.
2. Select the [notebook](#glossary) to store the [literature note](#glossary): Only notebooks that have been opened in the document tree can be selected from the drop-down list. If the previously selected notebook is not open in the current session, the plugin will be unable to function.
3. Fill in the [library](#glossary) path: The path should start with `/`, for example, `/References` or `/Assets/References`. Note that this path is essentially the document's location, so do not include a trailing `/`. **Note: If you change the path of the library, the literature libraries on the previous path will become invalid. Additionally, please ensure that the document exists, as the plugin does not automatically create the library document if it does not exist.**
4. Select the [database](#glossary) type: Choose the type of database you want to use. If you use data files, please refer to the section [Using Data Files as the Literature Data Source](#if-you-use-bibtex-and-csl-json-files-as-the-literature-data-source). If you use Zotero or Juris-M, please refer to the section [Using Zotero or Juris-M as the Literature Data Source](#if-you-use-zotero-or-juris-m-as-the-literature-data-source).
5. Fill in the template for the title of literature content documents: Enter the template for generating titles for literature content documents. For the specific syntax of the template, please refer to [Template Syntax](#how-to-write-templates).
6. Fill in the [literature note](#glossary) template: Fill in the template for generating the literature note document's text content. Refer to the section [Template Syntax](#how-to-write-templates) for specific template syntax.
7. If you believe you are an experienced user familiar with regular expression searching and SiYuan citation logic and want to be compatible with workflows outside of SiYuan, you can choose to enable the "Customize Citation Link" switch. For the specific effect of enabling this switch, refer to the section [What Happens If I Enable the "Customize Citation Link" Switch?](#what-happens-if-i-enable-the-customize-citation-link-switch)
8. Fill in the [citation link](#glossary) template: Fill in the template for generating the anchor text of the citation link. Refer to the section [Template Syntax](#how-to-write-templates) for specific template syntax.
9. If you want to redesign your templates and data or want to see the default settings set by the plugin author, you can click the ["Delete Data"](#what-happens-when-i-click-the-delete-data-button) button to delete all the saved settings data.
10. Click "Save" to store and apply the settings.

### If You Use BibTeX and CSL-JSON Files as the Literature Data Source

- Place any number of `csl-json` and `bibtex` files in the `[Workspace]/data/storage/petal/siyuan-plugin-citation/references/` folder, which contain the literature you want to reference. Refer to [How to Obtain Literature Data Files](#how-to-obtain-bibtex-or-csl-json-files) for methods to obtain the files.
- In the plugin's settings panel, select the "BibTeX and CSL-JSON" option for the database type.

### If You Use Zotero or Juris-M as the Literature Data Source

- **Ensure that you have installed the [Better BibTex](https://github.com/retorquere/zotero-better-bibtex) plugin in Zotero or Juris-M.**
- In the plugin's settings panel, select the "Zotero" or "Juris-M" option for the database type.
- Make sure Zotero or Juris-M is open before using the plugin.

## How to Use This Plugin

## Current Features

- Slash menu:
  - Add Citation: Open the literature search panel, select a literature, and insert its [citation link](#glossary) at the cursor position, updating the library.

    You can access this option in the slash menu by typing "插入文献引用," "addcitation," or "charuwenxianyinyong."

  - Add Notes of Literature: Open the literature search panel, select a literature, and insert its note at the cursor position (this operation does not update the library). This is equivalent to copying and inserting the note from Zotero/Juris-M into the current cursor position.

    You can access this option in the slash menu by typing "插入文献笔记," "addnotesofliterature," or "charuwenxianbiji."

- Commands (can be searched and executed directly in the `Plugin Button - Command Panel` or set shortcuts in `Settings - Shortcuts - Plugin - Citation for SiYuan`):
  - Reload the Database: Reload the [database](#glossary) and reindex the [library](#glossary) based on the source of the literature. This command also updates the library.
  - Refresh all literature content document titles: Based on the current set [title template](#configure-the-plugin), refresh the titles of all literature content documents in the [literature library](#glossary).
  - Copy Citation: Open the literature search panel, select a literature, and copy its [citation link](#glossary) to the clipboard, updating the library.
- Title block icon menu:
  - Refresh Citations: Refresh the anchor text of all [citation links](#glossary) in the current document using the current [citation link template](#configure-the-plugin). When the citation link template changes, you can use this feature to refresh the formatting of all citation links in the document.

![ ](./assets/protyleslash.png)

![ ](./assets/setcommand.png)

![ ](./assets/commandpanel.png)

![ ](./assets/titleIconMenu.jpg)

![ ](./assets/searchpanel.png)

![ ](./assets/zoteroIntegration.png)

## Template Syntax

## How to write templates

- The template text syntax uses Markdown syntax.
- The parts to be replaced by variables are wrapped in `{{ }}`, for example `{{title}}`.
- In the input box of the [Literature Content Template](#Setting-the-plugin), you can use `Shift/Ctrl + Enter` to line break and use `Tab` to input tab characters.

The following variables can be used in the literature content and citation templates:

```markdown
- {{citekey}}: The unique identifier of the literature, it is recommended to use the better biblatex plugin of Zotero to generate
- {{abstract}}: Abstract
- {{authorString}}: A string of all authors arranged in order
- {{containerTitle}}: The title of the publication (journal, conference proceedings, etc.) where the literature is located
- {{DOI}}: The DOI of the literature
- {{eprint}}: Preprint
- {{eprinttype}}: Preprint type
- {{eventPlace}}: (Conference, etc.) location
- {{page}}: Page number
- {{publisher}}: Publisher
- {{publisherPlace}}: Publisher's location
- {{tags}}: All tags, connected by ", ", this variable is not available in CSL-JSON files
- {{title}}: Title
- {{titleShort}}: Abbreviated title, many literature do not have abbreviated titles
- {{type}}: Type of literature (Note: The literature type identifier obtained directly from Zotero may be different from the one obtained after export)
- {{URL}}: The URL of the literature
- {{year}}: The publication year of the literature
- {{files}}: Attachments of the literature. It will be displayed in the default style, one file per line, with a link to Zotero (if it is a PDF, the link can directly open the PDF in Zotero).
- {{fileList}}: Attachment of the literature, in the format of the initial data source, for user customization. It is an list of object and its properties can be accessed using `.`. The specific method of accessing properties is as follows:
  - {{fileList[i].type}}: The type of the attachment, i.e., the file extension
  - {{fileList[i].fileName}}: The complete file name of the attachment
  - {{fileList[i].path}}: The absolute path of the attachment, with `file://`
  - {{fileList[i].zoteroSelectURI}}: The link that can select the attachment in Zotero (link only)
  - {{fileList[i].zoteroOpenURI}}: The link that can directly open the attachment in Zotero (link only, only for PDF files)
- {{zoteroSelectURI}}: The link that can directly jump to the corresponding entry in Zotero
- {{note}}: Notes made in Zotero, the links in it can directly jump to Zotero
```

In addition, the following variables can be used in the citation link:

```Markdown
- {{shortAuthor}}: A shorter author string generated according to the IEEE format (approximately), for example `Lin and Morse et al.`
- {{citeFileID}}: The ID of the literature content document in the Obsidian, used to assist in generating citation links or external links, for example `20230707192208-ocs4482`
```

The template also includes the following special variables:

{{getNow}}: The moment() object of the current time, you can customize the format in the template, the method refers to [moment.js](https://momentjs.com/).

### Advanced Template Syntax

In version 0.0.6, the template handling section utilizes [template.js](https://github.com/yanhaijing/template.js). To accommodate the template syntax commonly used by general users, before performing variable calculations and replacements, all `{{ }}` will be replaced with `<%= %>` for template.js to process the templates. Therefore, besides using the existing `{{variable}}` syntax, there are many advanced usage methods available:

1. Wrap JavaScript statements within `{{ }}`.
2. Use the native syntax of template.js (you can refer to the [EJS syntax](https://ejs.bootcss.com/#docs)).

For example, the following template allows the line to not appear as "**Tags**: " when there are no `{{tags}}` variables:

```JavaScript
{{ tags.length ? `\n**Tags**:\t\t${tags}` : "" }}
```

And the following template prevents the "Files" section from being generated when there are no associated files:

```JavaScript
<% if (files.length) { %>
# Files

{{files}}
<% } %>
```

The following template has the same effect as the previous one:

```JavaScript
<% if (fileList.length) { %>
# Files

{{fileList.map(file => {if (file.type === "pdf") return `[[Open]](${file.zoteroOpenURI})\t|\t[${file.fileName}](file.path)`; else return `[[Locate]](${file.zoteroSelectURI})\t|\t[${file.fileName}](file.path)`;}).join("\n")}}
<% } %>
```

**Note:** All variables return strings and will not directly return `null`. Therefore, please use `.length` to check if a variable exists.

## Explaining Literature Note

In version v0.0.8, the literature note now supports a user data section, indicated by a top-level heading named "User Data" by default (this allows the floating preview in Obsidian to directly preview all user data). The content after this heading will not be updated with citations, but it also imposes some formatting requirements on the literature note. The format of an individual literature note document is as follows:

```markdown
((User Data Title ID 'User Data Title'))

Template-generated content

# User Data Title (default: "User Data")

User data content
```

### What can be modified

- Everything below the `# User Data Title` (including the content of this heading) can be modified and will not be updated with citations.
- Anchored text can be added to the beginning citation, but it will not change with the user data title (it becomes static anchored text).

### What cannot be modified

- The content above the `# User Data Title`, including the top-most citation, will be updated with citations, so please do not modify it.
- **Do not delete the `# User Data Title` heading itself!!** If you only clear its content, the block ID will not change. However, if you delete this heading and create a new one, the block ID will change, and all user data below it will be cleared in the next citation update!!!
- **Do not delete the citation at the beginning of the document!** If you delete this citation, the plugin will not be able to locate the user data section, and all content will be refreshed.

### How to fix if the citation/heading has been deleted

- Add a heading at the top of the data you want to retain.
- Right-click on the heading, select "Copy," and choose "Copy as Block Reference." Paste it as the first line in the document.
- **Ensure that only the reference link is present in the first line of the document.**

## How to Obtain BibTeX or CSL-JSON Files

- If you use Zotero:
  
  Use the Better BibTeX plugin to export your library in the format of Better BibLaTex or Better CSL JSON (select "Keep Update" to apply changes made to Zotero entries in SiYuan in real-time).

- If you use other reference management software:
  
  The `sample.bib` and `sample.json` files in `[Workspace]/data/siyuan-plugin-citation/sample-data/` are provided for reference. If your software can provide exports in these formats, you can use them.

  ***Note: In the .bib and .json files, each literature's citekey/id must be unique.***

## What Happens If I Enable the "Customize Citation Link" Switch?

The [citation link template](#configure-the-plugin) will be fully customized, meaning that the template will no longer generate anchor text, but will be **directly inserted into the document**. In this case, to avoid affecting your own content, the refresh citation feature of the plugin will **not maintain the non-link parts (outside the double brackets)**.

**The regular expression for finding citation links is /\\(\\((.\*?)\\\"(.\*?)\\\"\\)\\)/g. Please make sure your template format conforms to this expression.**

⚠️**Note: After enabling the switch, please make sure your template includes `...(({{citeFileID}} "..."))...`, otherwise the generated links will not be able to reference the literature note.**

## What Happens When I Click the "Delete Data" Button?

Clicking the "Delete Data" button will delete all the data saved in the settings panel and restore it to the initial values set by the plugin author.

**Note**: This feature **does not** delete the .bib and .json files!

## Common Error Types

### Please Select Notebook in Setting Tab

Please check if the [notebook](#configure-the-plugin) option in the settings panel is blank. The library must be located in an open notebook, otherwise, the plugin will not work. If the notebook where the library is located is closed, you need to reselect the notebook and path for the library.

### Library Directory Does Not Exist

Please check if the [library](#glossary) document exists. To prevent users from unintentionally disrupting their document hierarchy, the plugin does not automatically create a document in the document tree. When the library document does not exist, the plugin's functionality cannot be used.

After creating the document, you need to [reload the database](#current-features). Although it is not necessary, it is **highly recommended restarting the SiYuan** to ensure the effectiveness of setting.

### Zotero/Juris-M Is Not Running

Please check the status of your Zotero/Juris-M and ensure that you have installed the [Better BibTeX](https://github.com/retorquere/zotero-better-bibtex) plugin in Zotero/Juris-M. This plugin relies on the Better BibTeX plugin to run. There are plans to directly access zotero.sqlite without relying on this plugin in the future.

### All These Problems Are Not Included

It is welcomed to raise an [issue](https://github.com/WingDr/siyuan-plugin-citation/issues)

## TODO

- [x] Integration with Zotero (Long-term)
- [ ] Support user-customized area in literature note (Probably in the next version)
- [ ] Support copying markdown text with citations (Probably in the next version)
- [ ] Support direct access to zotero.sqlite, refer to [obsidian-zotero](https://github.com/PKM-er/obsidian-zotero) (Long-term and difficult)
- [ ] Export support for Word (Long-term)
- [ ] Export support for LaTeX (Long-term)
- [ ] Support citation of formulas and automatic numbering (Long-term)
- [ ] Support adding LaTeX definition blocks such as Remark, Lemma (Long-term)
- [ ] UI beautification (Mind-boggling)
- [ ] Function optimization:
  - [ ] More lenient template/path format restrictions (Please provide more feedback through issue reports)
  - [ ] Better template handling (Difficult to implement)
  - [ ] Remove invalid functions from the command panel (Waiting for updates from the SiYuan team)
  - [ ] Support using indexes in citation links (Waiting for updates from the SiYuan team)
  - [ ] Adaptation for mobile devices (Anyone willing to test?)

## Acknowledgments

The code of the following projects was referenced, and I would like to express my gratitude:

[sy-transfer-refs](https://github.com/frostime/sy-transfer-refs)

[obsidian-citation-plugin](https://github.com/hans/obsidian-citation-plugin)

[siyuan-plugin-importer](https://github.com/terwer/siyuan-plugin-importer)

[obsidian-zotero-integration](https://github.com/mgmeyers/obsidian-zotero-integration)

[template.js](https://github.com/yanhaijing/template.js)

Thanks to everyone in the "思源笔记折腾群" for answering my questions and providing guidance. 

Thanks to [Geo123abc](https://github.com/Geo123abc) for providing information, suggestions, and testing support.

## Sponsorship

> I'll just put a QR code here for donations, but feel free to use it for free. Providing feedback and seeing more people using it is the greatest encouragement for me.

![ ](./assets/weixin.jpg)

![ ](./assets/alipay.jpg)