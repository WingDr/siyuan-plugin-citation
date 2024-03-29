[中文 README](https://github.com/WingDr/siyuan-plugin-citation/blob/main/README_zh_CN.md)

# Citation for SiYuan

> A citation plugin that implements basic functionality, hoping to make your SiYuan more academically oriented.

**Update 0.3.6:**

1. **Opened up the usage of Docker and remote web version. By installing the** **[CORS Unblock plugin](https://webextension.org/listing/access-control.html)** **on your browser, you can communicate with Zotero through the browser frontend.**
2. **Changed the reference mode of user data to use Zotero links, which will no longer occupy reverse links. Also, the user data identifier has been changed from citation starting with &quot;judgment&quot; to a custom attribute using the user data title.**
3. **Interested users can compile and try the code under the [dev](https://github.com/WingDr/siyuan-plugin-citation/tree/dev) branch by themselves. The new features are mainly pushed here, but the frontend is not yet fully developed.**
4. **For users who have downloaded the latest debug-bridge plugin, please go to Zotero's `Edit -> Preferences -> Advanced -> Editor` and set `extensions.zotero.debug-bridge.token` to your password, and update to the latest version of the citation plugin to use it properly.**

**Starting from version 0.1.1, this plugin now supports accessing Zotero using the [debug-bridge](https://github.com/retorquere/zotero-better-bibtex/releases?q=debug-bridge&expanded=true) plugin. Compared to the current method of using better-bibtex, this approach provides faster access and higher efficiency. Additionally, it enables many extra functionalities (for more details, see the [ttChen's Quicker Actions](https://getquicker.net/User/Actions/395924-ttChen), which might be integrated into this plugin for both Siyuan and Zotero functionalities). Users who wish to utilize this feature should prepare in advance by following the specific steps outlined in [Run Javascript in Zotero](https://www.yuque.com/chentaotao-cf9fr/gthfy4/clqahv57w5ugmdev).**

**Special thanks to [Geo123abc](https://github.com/Geo123abc) for creating the [tutorial video](https://www.bilibili.com/video/BV17u411j79z/?vd_source=b4b4ca14b1a866918dcef4ca52896f03).**

## Features

Add citations to your notes, which refer to literature note generated in a specified folder, as shown in the following image:

![ ](./assets/preview.jpg)

## Glossary

1. **Notebook**: Refers to a notebook in the SiYuan note document tree. The library can only be placed in one of the open notebooks. If you switch to another notebook for the library, the previously selected notebook's library will become invalid.
2. **Database**: The original data source of the literature, currently supports three types: data files (BibTeX and CSL-JSON), Zotero, and Juris-M. The data files are reimported every time the software is launched, but if the files themselves change during use, you need to **"Reload the Database"** (through the settings panel or command) or **"Restart the SiYuan software"** for the changes to take effect.
3. **Library**: The location where the inserted citation links point to the literature note. It is essentially a *document located at a specific path*. Its sub-documents are all literature note that has been referenced. The content of this document itself will not be modified, but it will be updated and refreshed when citations are inserted.
4. **Literature Note Document**: Generated documents based on the original data of the literature and the "Literature Note Template" set in the settings. *The titles and names of newly created documents are set to the corresponding literature's citekey or itemKey*. Currently, the content of this document refreshes every time the corresponding literature is referenced. Hence, **please refrain from modifying the custom attribute 'literature-key' within the document properties**. The literature content now supports a user data area, see [Detailed Explanation of Literature Content](#detailed-explanation-of-literature-content), **please avoid inserting personal content in non-user data areas**.
5. **Citation Link**: The reference link inserted in the document (or copied to the clipboard), which points to the corresponding literature note in the library. The anchor text of the link is generated based on the literature's original data and the "Citation Link Template" filled in the settings panel.

## Preparation before Use

### Decide Which Literature Data Source to Choose

Currently, you can use three different sources for literature data: Data Files (BibTeX and CSL-JSON), Zotero/Juris-M (using Better BibTeX plugin), and Zotero/Juris-M (using debug-bridge plugin). The following table provides a comparison between the three data sources:

| Data Source | BibTeX and CSL-JSON | Zotero/Juris-M with Better BibTeX plugin | Zotero/Juris-M with debug-bridge plugin |
|:------------|:-------------------:|:-------------------------------------:|:--------------------------------------:|
| Literature Identifier | <b>citekey</b><br>Allows multiple files<br>Ensure uniqueness on your own | <b>citekey</b><br>Generated by BBT | <b>citekey / itemKey</b><br>citekey generated by BBT<br>itemKey generated by Zotero |
| Search Panel | Citation plugin panel | Zotero panel | Citation plugin panel / Zotero panel (optional) |
| Initialization Speed | Slow | Fast | Fast |
| Search/Insert Speed | Fast | Slow | Fast (Citation plugin panel) |
| Compatible with Zotero 7 | - | × (temporarily) | √ |
| Compatible with Other Reference Managers | ✓ | × | × |
| Supports Importing PDF Annotations | × | × | ✓ |
| Support for Automatic Referencing from Zotero Drag-and-Drop | × | ✓ | ✓ |
| Supports Inserting Multiple Literature at Once via Search Panel | × | ✓ | × (Citation plugin panel)<br>✓ (Zotero panel) |
| Insert Zotero Selected Items | × | × | ✓ |
| Insert Custom Tags into Zotero Items | × | × | ✓ |
| Generate Word Document with Citations (future version) | × | ✓ | ✓ |

### Configure the Plugin

1. Go to the settings panel: Click on the gear icon next to the `Citation for SiYuan` plugin switch in `Settings - Marketplace - Downloaded` to enter the settings panel. Alternatively, you can directly enter the plugin's settings panel by clicking on "Citation for SiYuan" in the plugin menu after clicking on the top toolbar's plugin button.
2. Select the [notebook](#glossary) to store the [literature note](#glossary): Only notebooks that have been opened in the document tree can be selected from the drop-down list. If the previously selected notebook is not open in the current session, the plugin will be unable to function.
3. Fill in the [library](#glossary) path: The path should start with `/`, for example, `/References` or `/Assets/References`. Note that this path is essentially the document's location, so do not include a trailing `/`. **Note: If you change the path of the library, the literature libraries on the previous path will become invalid. Additionally, please ensure that the document exists, as the plugin does not automatically create the library document if it does not exist.**
4. Choose [Database](#glossary) Type: Select the type of database you want to use. If using data files, please refer to [Using Data Files as Literature Data Source](#using-data-files-as-literature-data-source). If using Zotero/Juris-M (using Better BibTeX plugin), refer to [Using Zotero/Juris-M (using Better BibTeX plugin) as Literature Data Source](#using-zoterobetter-bibtex-as-literature-data-source). If using Zotero/Juris-M (using debug-bridge plugin), refer to [Using Zotero/Juris-M (using debug-bridge plugin) as Literature Data Source](#using-zoterojuris-m-debug-bridge-as-literature-data-source).
5. If you choose Zotero/Juris-M (using debug-bridge plugin) as the literature data source, it is recommended to enable the "Use Item Key as Index" option.
6. Fill in the template for the title of literature content documents: Enter the template for generating titles for literature content documents. For the specific syntax of the template, please refer to [Template Syntax](#how-to-write-templates).
7. Fill in the [literature note](#glossary) template: Fill in the template for generating the literature note document's text content. Refer to the section [Template Syntax](#how-to-write-templates) for specific template syntax.
8. If you believe you are an experienced user familiar with regular expression searching and SiYuan citation logic and want to be compatible with workflows outside of SiYuan, you can choose to enable the "Customize Citation Link" switch. For the specific effect of enabling this switch, refer to the section [What Happens If I Enable the "Customize Citation Link" Switch?](#what-happens-if-i-enable-the-customize-citation-link-switch)
9. Fill in the [citation link](#glossary) template: Fill in the template for generating the anchor text of the citation link. Refer to the section [Template Syntax](#how-to-write-templates) for specific template syntax.
10. If you want to redesign your templates and data or want to see the default settings set by the plugin author, you can click the ["Delete Data"](#what-happens-when-i-click-the-delete-data-button) button to delete all the saved settings data.
11. Choose whether to use dynamic anchor text for citation links (if the "Custom Citation" switch is also turned on, you will need to input a document naming template to customize the naming of literature note documents during insertion). Refer to [Choosing Between Static and Dynamic Anchor Text for Citation Links](#choosing-between-static-and-dynamic-anchor-text-for-citation-links) for more details.
12. Settings information will be automatically saved after closing the settings panel.
13. Restart SiYuan (fully exit if in the system tray). If the settings are not taking effect after a restart or if there is a version mismatch after updating the plugin, restart one or two more times. This might help resolve issues, but some bugs might still exist.

**If you have any doubts about this process, please refer to the [tutorial video](https://www.bilibili.com/video/BV17u411j79z/?vd_source=b4b4ca14b1a866918dcef4ca52896f03) created by [Geo123abc](https://github.com/Geo123abc). If you still have questions, feel free to [raise an issue](https://github.com/WingDr/siyuan-plugin-citation/issues) on the plugin's GitHub repository or contact me via email (siyuan_citation@126.com)**

### If You Use BibTeX and CSL-JSON Files as the Literature Data Source

- Place any number of `csl-json` and `bibtex` files in the `[Workspace]/data/storage/petal/siyuan-plugin-citation/references/` folder, which contain the literature you want to reference. Refer to [How to Obtain Literature Data Files](#how-to-obtain-bibtex-or-csl-json-files) for methods to obtain the files.
- In the plugin's settings panel, select the "BibTeX and CSL-JSON" option for the database type.


### If You Use Zotero/Juris-M (better-bibtex) as Literature Data Source

- **Ensure that you have installed the [Better BibTeX](https://github.com/retorquere/zotero-better-bibtex) plugin in Zotero or Juris-M.**
- In the plugin's settings panel, select `Zotero (better-bibtex)` or `Juris-M (better-bibtex)` as the database type.
- Make sure your Zotero or Juris-M is open before using the plugin.

### If You Use Zotero/Juris-M (debug-bridge) as Literature Data Source

- **Make sure you have installed the [debug-bridge](https://github.com/retorquere/zotero-better-bibtex/releases/download/debug-bridge/debug-bridge-6.7.79.emile.limonia.xpi) plugin in Zotero or Juris-M, and follow the [Run Javascript in Zotero](https://www.yuque.com/chentaotao-cf9fr/gthfy4/clqahv57w5ugmdev) tutorial for configuration (you can choose not to use "CTT" as the password and set it in the settings panel accordingly).**
- It is still recommended to install the Better BibTeX plugin in Zotero to automatically generate the citekey attribute for items.
- In the plugin's settings panel, select `Zotero (debug-bridge)` or `Juris-M (debug-bridge)` as the database type.
- In the "debug-bridge plugin" section of the settings panel, enter the password you set during configuration and select SiYuan (Citation plugin panel) or the Zotero panel as the search panel.
- Ensure that your Zotero or Juris-M is open before using the plugin.

## How to Use This Plugin

## Current Features

- Slash Menu:
  - Insert Literature Citation: Open the literature search panel, select the literature, and insert its [citation link](#glossary) at the current cursor position, and update the literature library.

    You can access this option in the slash menu by typing "插入文献引用," "addcitation," or "charuwenxianyinyong."

  - Insert Literature Note: Open the literature search panel, select the literature, and insert its note at the current cursor position (this operation does not update the literature library). [Equivalent to copying the notes from Zotero/Juris-M and inserting them at the current cursor position]

    You can access this option in the slash menu by typing "插入文献笔记," "addliteraturenotes," or "charuwenxianbiji."

  - Cite Zotero Selected Items (debug-bridge plugin only): After selecting literature in Zotero, running this command will directly insert the selected (multiple) literature at the current cursor position.

  You can access this option in the slash menu by typing "引用Zotero中选中的文献," "addzoteroselecteditemscitations," or "yinyongzoterozhongxuanzhongdetiaomu."

- Commands (can be searched directly in the `Top Bar Plugin Button - Command Panel` or set shortcuts in `Settings - Shortcuts - Plugins - Literature Reference`):
  - Reload Database: Reload the [database](#glossary) based on the source of the literature and re-index the [literature library](#glossary).
  - Insert Literature Citation: Open the literature search panel, select the literature, and insert its [citation link](#glossary) at the current cursor position, and update the literature library. If not called by a shortcut key or the cursor is not focused in the editor, it will be copied to the clipboard instead.
  - Insert Literature Note: Open the literature search panel, select the literature, and insert its note at the current cursor position. If not called by a shortcut key or the cursor is not focused in the editor, it will be copied to the clipboard instead.
  - Cite Zotero Selected Items: Same function as in the Slash Menu. If not called by a shortcut key or the cursor is not focused in the editor, it will be copied to the clipboard instead.
  - Refresh All Literature Notes: Refresh the content of all literature note documents in the library. It's recommended to wait for a while before proceeding with the next action.
- Document's upper-right "More" menu:
  - Refresh Citation: Use the current [citation link template](#configuring-the-plugin) to refresh all [citation links](#glossary) in the current document (**in the [literature library](#glossary) set to store [literature content](#glossary)**). When the citation link template changes, you can use this function to refresh all citation links in the document.
  - Refresh Literature Note (Only if the document is in the literature library and loaded): Refresh the content of the current document, which is equivalent to referencing the same literature again without copying the citation link.

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

In the templates for literature content and citations, the following variables can be used, and they are **undefined** by default if not present:

```markdown
- {{key}}: Unique identifier of the literature, depending on whether "Use itemKey as Index" is enabled, it will be "libraryID_citekey" or "libraryID_itemKey," always exists.
- {{citekey}}: Identifier of the literature, requires ensuring uniqueness when using data files, automatically generated by the Better BibTeX plugin, if not installed, it will be the same as itemKey.
- {{itemKey}}: Unique identifier of the literature entry in Zotero, automatically generated by Zotero, does not exist if not using Zotero.
- {{libraryID}}: Library ID of the literature content in Zotero, defaults to 1 if using data files, and will support multiple libraries (multiple files with duplicate citekeys) in the future, does not exist if not using Zotero.
- {{abstract}}: Abstract.
- {{authorString}}: String of all authors sorted in order, empty string if not present.
- {{containerTitle}}: Title of the publication (journal, conference proceedings, etc.) where the literature is located, null if not present.
- {{DOI}}: DOI of the literature.
- {{eprint}}: Eprint.
- {{eprinttype}}: Type of the eprint.
- {{eventPlace}}: Location of the event (e.g., conference).
- {{page}}: Page numbers.
- {{publisher}}: Publisher.
- {{publisherPlace}}: Place of publication.
- {{tags}}: All tags, connected with ", "; CSL-JSON files do not have this variable, empty string if not present.
- {{title}}: Title.
- {{titleShort}}: Abbreviated title, many literature entries do not have an abbreviated title.
- {{type}}: Type of the literature (note: the type identifier may be different when directly obtained from Zotero and when obtained after exporting).
- {{URL}}: URL of the literature.
- {{year}}: Publication year of the literature.
- {{files}}: Attachments of the literature. Will be displayed in the default format, one file per line, with a link to navigate to the file in Zotero (if it is a PDF, the link can directly open the PDF in Zotero).
- {{fileList}}: Attachments of the literature in the initial data source format, for user customization. It is an object list and can be accessed by using ".", empty list if not present. The method to call its attributes is as follows:
  - {{fileList[i].type}}: Type of the attachment, i.e., the file extension.
  - {{fileList[i].fileName}}: Complete file name of the attachment.
  - {{fileList[i].path}}: Absolute path of the attachment, with `file://`.
  - {{fileList[i].zoteroSelectURI}}: Link to select the attachment in Zotero (link only).
  - {{fileList[i].zoteroOpenURI}}: Link to directly open the attachment in Zotero (link only, for PDF files only).
- {{zoteroSelectURI}}: Directly navigate to the corresponding item in Zotero.
- {{note}}: Notes made in Zotero, supports direct navigation to Zotero through links.
```

Additionally, the following variables can be used in the citation links:

```markdown
- {{shortAuthor}}: Generates a shorter author string according to the IEEE format (approximately), for example, "Lin and Morse et al.," empty string if not present.
- {{citeFileID}}: ID of the literature content document in SiYuan, used to assist in generating citation links or external links, for example, `20230707192208-ocs4482`.
```

The templates also include the following special variables:

- {{getNow}}: `moment()` object of the current time, allows customizing the format in the template, method reference [moment.js](https://momentjs.com/).

If you use Zotero/Juris-M (debug-bridge) as the data source for literature, you can use the following variables:

```markdown
- {{annotations}}: PDF annotations of the literature, distinguished by the document they belong to, also supports displaying annotations in batches, empty string if not present.
- {{annotationList}}: Initial data source format of PDF annotations, for user customization. It is an object list and can be accessed by using ".", empty list if not present. The method to call its attributes is as follows:
  - {{annotationList[i].parentKey}}: itemKey of the Zotero item where the annotation is located.
  - {{annotationList[i].parentTitle}}: Title of the PDF file where the annotation is located.
  - {{annotationList[i].detail}}: Details of single PDF file annotations, which is a list.
    - {{annotationList[i].detail[j].key}}: itemKey of the single annotation.
    - {{annotationList[i].detail[j].annotationText}}: Text content of the single annotation.
    - {{annotationList[i].detail[j].annotationComment}}: Comment of the single annotation.
    - {{annotationList[i].detail[j].annotationPosition}}: Position of the single annotation, you can use `.pageIndex` to obtain the page number of the annotation.
    - {{annotationList[i].detail[j].zoteroOpenURI}}: Link to directly open the location of the annotation in Zotero.
```

For more variables, check the "entry-data" attribute of the literature content document after importing, which includes all the information imported for that literature.

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

## Choosing Between Static and Dynamic Anchor Text for Citation Links

This plugin strongly recommends using static anchor text for citation links (meaning the anchor text is enclosed in double quotes within the link and is not updated when the referenced document's name changes). This approach is not only more stable but also allows for the possibility of adding parameters to the citation links in future updates, allowing for different link formats (similar to \citep and \citet in LaTeX).

If dynamic anchor text for citation links is used, the document ID of the literature content will be temporarily displayed after referencing. The content will only appear after refreshing with `F5`.

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
- [x] Support user-customized area in literature note (Probably in the next version)
- [ ] Support copying markdown text with citations (Probably in the next version)
- [ ] Support direct access to zotero.sqlite, refer to [obsidian-zotero](https://github.com/PKM-er/obsidian-zotero) (Long-term and difficult)
- [ ] Export support for Word (Long-term)
- [ ] Export support for LaTeX (Long-term)
- [ ] Support citation of formulas and automatic numbering (Long-term)
- [ ] Support adding LaTeX definition blocks such as Remark, Lemma (Long-term)
- [x] UI beautification (Mind-boggling)
- [ ] Function optimization:
  - [ ] More lenient template/path format restrictions (Please provide more feedback through issue reports)
  - [x] Better template handling (Difficult to implement)
  - [x] Remove invalid functions from the command panel (Waiting for updates from the SiYuan team)
  - [ ] Support using indexes in citation links (Waiting for updates from the SiYuan team)
  - [ ] Adaptation for mobile devices (Anyone willing to test?)

## Developers

This plugin exposes specific events for external calls. Here's how you can utilize them:

1. Get the `eventBus` object of this plugin under `window.siyuan.ws.app.plugins`

   `window.siyuan.ws.app.plugins.find(p => p.name === "siyuan-plugin-citation").eventBus`

2. Use `eventBus.emit(rule: TRuleType, e: CustomEventDetail)` to send requests

```typescript
  type TRuleType = "GetFromPool" | "Refresh";
  interface RefreshEventDetail extends CustomEventDetail {
    type: "database" | "literature note";
    docIDs?: string[];
    keys?: string[];
    refreshAll?: boolean;
    confirmUserData?: boolean;
  }

  interface GetEventDetail extends CustomEventDetail {
    keyorid: string;
    triggerFn: (idorkey: string) => any;
  }
```

- For the `GetFromPool` rule, the parameter `e` has a type of `GetEventDetail`.
- For the `Refresh` rule, the parameter `e` has a type of `RefreshEventDetail`. Use the `type` to choose whether to reload the database or refresh literature content. Set `confirmUserData` to `false` to avoid displaying the "User data not found" prompt.

## Acknowledgments

The code of the following projects was referenced, and I would like to express my gratitude:

[sy-transfer-refs](https://github.com/frostime/sy-transfer-refs)

[obsidian-citation-plugin](https://github.com/hans/obsidian-citation-plugin)

[siyuan-plugin-importer](https://github.com/terwer/siyuan-plugin-importer)

[obsidian-zotero-integration](https://github.com/mgmeyers/obsidian-zotero-integration)

[template.js](https://github.com/yanhaijing/template.js)

[siyuan-package-monorepo](https://github.com/Zuoqiu-Yingyi/siyuan-packages-monorepo)

Thanks to everyone in the "思源笔记折腾群" for answering my questions and providing guidance. 

Thanks to [Geo123abc](https://github.com/Geo123abc) and [ttChen](https://getquicker.net/User/Actions/395924-ttChen) for providing information, suggestions, and testing support.

## Sponsorship

> I actually prefer GitHub issues over sponsorship. Every question and request you raise there becomes my motivation.

<div style="display:flex;justify-content:center">
  <img src="./assets/sponsor_weixin.jpg" width="40%" height="40%">
</div>

<div style="display:flex;justify-content:center">
  <img src="./assets/sponsor_alipay.jpg" width="40%" height="40%">
</div>