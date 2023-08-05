import {
    Plugin,
    getFrontend,
    getBackend,
} from "siyuan";

import KernelApi from "./api/kernel-api";
import { Database, type DatabaseType } from "./database/database";
import {
    Reference
} from "./ReferenceManager/reference";
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
    defaultTitleTemplate,
    defaultDBPassword,
    dbSearchDialogTypes
} from "./utils/constants";
import {
    createLogger,
    type ILogger
} from "./utils/simple-logger";

import "./index.scss";
import { createNoticer, type INoticer } from "./utils/noticer";
import { changeUpdate } from "./utils/updates";
import { LiteraturePool } from "./ReferenceManager/pool";
import type { EventTrigger } from "./frontEnd/eventTrigger";
import { SettingTab } from "./frontEnd/settingTab/settingTab";

export default class SiYuanPluginCitation extends Plugin {

    public isMobile: boolean;
    public isRefPathExist: boolean;

    public literaturePool: LiteraturePool;

    public database: Database;
    public reference: Reference;
    public interactionManager: InteractionManager;
    public kernelApi: KernelApi;
    public eventTrigger: EventTrigger;
    public settingTab: SettingTab;

    public noticer: INoticer;
    private logger: ILogger;

    async onload() {
        this.logger = createLogger("index");
        this.noticer = createNoticer();
        this.literaturePool = new LiteraturePool();

        if (isDev) this.logger.info("插件载入");

        this.data[STORAGE_NAME] = {
            referenceNotebook: "",
            referencePath: defaultReferencePath,
            database: databaseType[0],
            titleTemplate: defaultTitleTemplate,
            noteTemplate: defaultNoteTemplate,
            linkTemplate: defaultLinkTemplate,
            customCiteText: false,
            useItemKey: false,
            zoteroLinkTitleTemplate: "",
            zoteroTagTemplate: "",
            dbPassword: defaultDBPassword,
            dbSearchDialogType: dbSearchDialogTypes[0]
          };

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        if (isDev) this.logger.info(`前端: ${getFrontend()}; 后端: ${getBackend()}`);
        
        if (isDev) this.logger.info("读取本地数据");
        await this.loadData(STORAGE_NAME);
        await changeUpdate(this);
        this.kernelApi = new KernelApi();

        this.interactionManager = new InteractionManager(this);
        await this.interactionManager.customSettingTab().then(setting => {
            this.settingTab = setting;
        });
        await this.interactionManager.customCommand();
        (await this.interactionManager.customProtyleSlash()).forEach(slash => {
            this.protyleSlash.push(slash);
        });
        this.interactionManager.eventBusReaction();

        return ;
    }

    async onLayoutReady() {
        this.database = new Database(this);
        await this.database.buildDatabase(this.data[STORAGE_NAME].database as DatabaseType);
        this.reference = new Reference(this);
    }

    openSetting(): void {
        this.settingTab.openSetting();
    }

    onunload() {
        if (isDev) this.logger.info("插件卸载，plugin=>", this);
    }
}
