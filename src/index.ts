import {
    Plugin,
    getFrontend,
    getBackend,
} from "siyuan";

import KernelApi from "./api/kernel-api";
import { 
    Library,
} from "./library";
import {
    insertCiteLink
} from "./modal";
import {
    Reference
} from "./reference";
import {
    InteractionManager
} from "./interaction";
import{
    loadLibrary,
    loadLocalRef
} from "./utils/util";
import {
    isDev,
    STORAGE_NAME,
    defaultLinkTemplate,
    defaultNoteTemplate,
    defaultReferencePath
} from "./utils/constants";
import {
    createLogger,
    ILogger
} from "./utils/simple-logger";

import "./index.scss";
import { createNoticer,INoticer } from "./utils/noticer";

export default class SiYuanPluginCitation extends Plugin {

    public isMobile: boolean;
    public isRefPathExist: boolean;

    public ck2idDict: {[ck: string]: string};
    public id2ckDict: {[id: string]: string};

    public library: Library;
    public reference: Reference;
    public interactionManager: InteractionManager;
    public insertModal: insertCiteLink;
    public kernelApi: KernelApi;

    public noticer: INoticer;
    private logger: ILogger;

    async onload() {
        this.logger = createLogger("index");
        this.noticer = createNoticer();

        if (isDev) this.logger.info("插件载入");

        this.data[STORAGE_NAME] = {
            referenceNotebook: "",
            referencePath: defaultReferencePath,
            noteTemplate: defaultNoteTemplate,
            linkTemplate: defaultLinkTemplate
        };

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        if (isDev) this.logger.info(`前端: ${getFrontend()}; 后端: ${getBackend()}`);
        
        if (isDev) this.logger.info("读取本地数据");
        await this.loadData(STORAGE_NAME);
        this.kernelApi = new KernelApi();
        this.reference = new Reference(this);
        this.interactionManager = new InteractionManager(this);

        this.interactionManager.eventBusReaction();
        await this.interactionManager.customSettingTab().then(setting => {
            this.setting = setting;
        });
        await this.interactionManager.customCommand();
        this.protyleSlash.push(await this.interactionManager.customProtyleSlash());
    }

    onLayoutReady(): void {
        if (isDev) this.logger.info("从本地文件载入文献库");
        loadLibrary(this).then(() => {
            this.insertModal = new insertCiteLink(this);
        });
        if (isDev) this.logger.info("载入引用");
        loadLocalRef(this);
    }

    onunload() {
        if (isDev) this.logger.info("插件卸载");
    }
}
