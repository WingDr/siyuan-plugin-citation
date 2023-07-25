import {
    Plugin,
    getFrontend,
    getBackend,
} from "siyuan";

import KernelApi from "./api/kernel-api";
import { Database, DatabaseType } from "./database/database";
import {
    Reference
} from "./reference";
import {
    InteractionManager
} from "./frontEnd/interaction";
import {
    isDev,
    STORAGE_NAME,
    defaultLinkTemplate,
    defaultNoteTemplate,
    defaultReferencePath,
    databaseType,
    defaultTitleTemplate
} from "./utils/constants";
import {
    createLogger,
    ILogger
} from "./utils/simple-logger";

import "./index.scss";
import { createNoticer,INoticer } from "./utils/noticer";
import { changeUpdate } from "./utils/updates";

export default class SiYuanPluginCitation extends Plugin {

    public isMobile: boolean;
    public isRefPathExist: boolean;

    public ck2idDict: {[ck: string]: string};
    public id2ckDict: {[id: string]: string};

    public database: Database;
    public reference: Reference;
    public interactionManager: InteractionManager;
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
            database: databaseType[0],
            titleTemplate: defaultTitleTemplate,
            noteTemplate: defaultNoteTemplate,
            linkTemplate: defaultLinkTemplate,
            CustomCiteText: false
        };

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        if (isDev) this.logger.info(`前端: ${getFrontend()}; 后端: ${getBackend()}`);
        
        if (isDev) this.logger.info("读取本地数据");
        await this.loadData(STORAGE_NAME);
        await changeUpdate(this);
        this.kernelApi = new KernelApi();

        this.interactionManager = new InteractionManager(this);
        this.interactionManager.eventBusReaction();
        await this.interactionManager.customSettingTab().then(setting => {
            this.setting = setting;
        });
        await this.interactionManager.customCommand();
        (await this.interactionManager.customProtyleSlash()).forEach(slash => {
            this.protyleSlash.push(slash);
        });
        return ;
    }

    async onLayoutReady() {
        this.database = new Database(this);
        await this.database.buildDatabase(this.data[STORAGE_NAME].database as DatabaseType);
        this.reference = new Reference(this);
    }

    onunload() {
        if (isDev) this.logger.info("插件卸载");
    }
}
