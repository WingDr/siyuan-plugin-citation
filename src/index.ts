import {
    Plugin,
    getFrontend,
    getBackend,
} from "siyuan";

import KernelApi from "./api/kernel-api";
import { Database, type DatabaseType } from "./database/database";
import { Reference } from "./references/reference";
import { InteractionManager } from "./frontEnd/interaction";
import { ExportManager } from "./export/exportManager";
import {
    isDev,
    STORAGE_NAME,
    defaultSettingData
} from "./utils/constants";
import {
    createLogger,
    type ILogger
} from "./utils/simple-logger";

import "./index.scss";
import { createNoticer, type INoticer } from "./utils/noticer";
import { changeUpdate } from "./utils/updates";
import { LiteraturePool } from "./references/pool";
import type { EventTrigger } from "./events/eventTrigger";
import { SettingTab } from "./frontEnd/settingTab/settingTab";
import { NetworkMananger } from "./api/networkManager";

export default class SiYuanPluginCitation extends Plugin {

    public isMobile: boolean;
    public isRefPathExist: boolean;

    public literaturePool: LiteraturePool;

    public database: Database;
    public reference: Reference;
    public interactionManager: InteractionManager;
    public exportManager: ExportManager;
    public networkManager: NetworkMananger;
    public kernelApi: KernelApi;
    public eventTrigger: EventTrigger;
    public settingTab: SettingTab;

    public noticer: INoticer;
    private logger: ILogger;

    async onload() {
        this.logger = createLogger("index");
        this.noticer = createNoticer();
        this.literaturePool = new LiteraturePool();
        this.networkManager = new NetworkMananger(this, 64);

        if (isDev) this.logger.info("插件载入");

        this.data[STORAGE_NAME] = defaultSettingData;

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        if (isDev) this.logger.info(`前端: ${getFrontend()}; 后端: ${getBackend()}`);
        
        if (isDev) this.logger.info("读取本地数据");
        await this.loadData(STORAGE_NAME);

        if (isDev) this.logger.info("获取到储存数据=>", this.data[STORAGE_NAME]);

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

        this.exportManager = new ExportManager(this);
        this.database = new Database(this);
        return this.database.buildDatabase(this.data[STORAGE_NAME].database as DatabaseType)
            .then(() => {
                this.reference = new Reference(this);
            });
    }

    async onLayoutReady() {
        // // @ts-ignore
        // this.eventBus.emit("Refresh", {type: "literature note", refreshAll: true, confirmUserData: false});
    }

    openSetting(): void {
        this.settingTab.openSetting();
    }

    onunload() {
        if (isDev) this.logger.info("插件卸载，plugin=>", this);
    }
}
