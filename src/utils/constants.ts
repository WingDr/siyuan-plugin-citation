export const workspaceDir = `${(window as any).siyuan.config.system.workspaceDir}`;
export const dataDir = `${(window as any).siyuan.config.system.dataDir}`;
export const mediaDir = "./assets";
export const isDev = process.env.NODE_ENV === "development";
// export const isDev = false;
export const showRequest = false;
export const siyuanApiUrl = "";
export const siyuanApiToken = "";

export const pluginIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="0 0 160 160"><path d="M71.9 27c-13 2.2-30.2 14.6-34.8 25.2-5.9 13.4-7.5 20.5-6.7 29.8 2 22.2 11.7 36.9 30.5 46.2 7.7 3.8 15.1 5.2 25.1 4.5 9.3-.7 18.4-3.4 24.2-7.2 4.2-2.8 12.8-11.1 12.8-12.4 0-.9-14.5-10.1-16-10.1-.5 0-3 1.5-5.5 3.4-8.3 6.4-19.6 7.9-31.6 4.4-3-.9-4.8-.7-10.2 1.1-7.3 2.3-11.7 2.7-11.7 1 0-.6 1.2-5 2.6-9.7 2.4-7.8 2.5-8.8 1.3-12.6-1.6-4.7-1.5-20.4.1-22 .5-.5 1-1.8 1-2.7 0-2.7 10.5-13.5 15.3-15.8 5.9-2.8 14.8-4 20.5-2.8 4.5.9 14.6 5.9 15.8 7.8.3.5 1.1.9 1.8.9 1.4 0 14.1-7.1 15.9-8.9.6-.6-.8-2.9-3.9-6.5-5.3-6-15-11.6-23.4-13.5-5.2-1.2-16.3-1.2-23.1-.1z"/></svg>';

export const refIcon = `<symbol id="iconLatexRef" viewBox="0 0 1024 1024">
    <rect x="192" y="320" width="640" height="384" rx="64" fill="none" stroke="currentColor" stroke-width="64"/>
    <path d="M384 512h256m-128 0V384m-128 128l128-128 128 128" stroke="currentColor" stroke-width="64" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>`;
export const eqrefIcon = `<symbol id="iconLatexEqref" viewBox="0 0 1024 1024">
    <circle cx="512" cy="512" r="320" fill="none" stroke="currentColor" stroke-width="64"/>
    <path d="M384 512h256m-128 0V384m-128 128l128-128 128 128" stroke="currentColor" stroke-width="64" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>`;
export const citeLinkStatic = "<span data-type=\"block-ref\" custom-cite-type=\"${cite_type}\" data-id=\"${id}\" data-subtype=\"s\">${link}</span>";
export const citeLinkDynamic = "<span data-type=\"block-ref\" custom-cite-type=\"${cite_type}\" data-id=\"${id}\" data-subtype=\"d\">${link}</span>";
export const DISALLOWED_FILENAME_CHARACTERS_RE = /[\/]/g;
export const refReg = /\(\((.*?)\)\)/;
export const refRegStatic = /\(\((.*?)\"(.*?)\"\)\)/g;
export const refRegDynamic = /\(\((.*?)\'(.*?)\'\)\)/g;

export const databaseType = ["BibTex and CSL-JSON", "Zotero (better-bibtex)", "Juris-M (better-bibtex)", "Zotero (debug-bridge)", "Juris-M (debug-bridge)", "Zotero (Web API)", "Juris-M (Web API)"] as const;
export const dbSearchDialogTypes = ["SiYuan", "Zotero"];
export const REF_DIR_PATH = "/references/";
// 用户指南不应该作为可以写入的笔记本
export const hiddenNotebook: Set<string> = new Set(["思源笔记用户指南", "SiYuan User Guide"]);
export const STORAGE_NAME = "menu-config";
export const defaultReferencePath = "/References";
export const defaultTitleTemplate = "{{citekey}}";
export const defaultNoteTemplate = `
---

**Title**:\t{{title}}

**Author**:\t{{authorString}}

**Year**:\t{{year}}

---

# Abstract

{{abstract}}

# Select on Zotero

[zotero]({{zoteroSelectURI}})

# Files

{{files}}

# Note

{{note}}
`;
export const defaultLinkTemplate = "({{shortAuthor}} {{year}})";
export const defaultDBPassword = "CTT";
export const defaultUserDataTile = "User Data";
export const defaultAttrViewBlock = "";
export const defaultAttrViewTemplate = "";
export const defaultUserDataTemplatePath = "";

export const defaultSettingData = {
    referenceNotebook: "",
    referencePath: defaultReferencePath,
    database: databaseType[0],
    titleTemplate: defaultTitleTemplate,
    userDataTitle: defaultUserDataTile,
    noteTemplate: defaultNoteTemplate,
    moveImgToAssets: true,
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
    dbSearchDialogType: dbSearchDialogTypes[0],
    shortAuthorLimit: 2,
    multiCitePrefix: "",
    multiCiteConnector: "",
    multiCiteSuffix: "",
    linkTemplatesGroup: [],
    attrViewBlock: defaultAttrViewBlock,
    attrViewTemplate: defaultAttrViewTemplate,
    userDataTemplatePath: defaultUserDataTemplatePath,
    useWholeDocAsUserData: false,
    useDefaultCiteType: true,
    consoleDebug: false,
    exportWordParam: "",
    exportLaTeXParam: "",
};
