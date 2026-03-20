import {
    Plugin,
    getFrontend,
    getBackend,
    Protyle,
    type IMenuItem,
    Menu,
} from "siyuan";

import KernelApi from "./api/kernel-api";
import { Database, type DatabaseType } from "./database/database";
import { Reference } from "./references/reference";
import { InteractionManager } from "./frontEnd/interaction";
import { ExportManager } from "./export/exportManager";
import {
    isDev,
    STORAGE_NAME,
    defaultSettingData,
    refIcon,
    eqrefIcon
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
import { NetworkMananger } from "./api/networkManagers";
import { sleep } from "./utils/util";

export default class SiYuanPluginCitation extends Plugin {

    public isMobile!: boolean;
    public isRefPathExist!: boolean;
    public isLoadingRef!: boolean;

    public literaturePool!: LiteraturePool;

    public database!: Database;
    public reference!: Reference;
    public interactionManager!: InteractionManager;
    public exportManager!: ExportManager;
    public kernelApi!: KernelApi;
    public eventTrigger!: EventTrigger;
    public settingTab!: SettingTab;
    public networkManager!: NetworkMananger;

    public noticer!: INoticer;
    private logger!: ILogger;

    async onload() {
        this.logger = createLogger("index");
        this.noticer = createNoticer();
        this.isLoadingRef = false;
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
        this.addIcons(refIcon);
        this.addIcons(eqrefIcon);

        await changeUpdate(this);
        this.kernelApi = new KernelApi();

        this.interactionManager = new InteractionManager(this);
        await this.interactionManager.customSettingTab().then(setting => {
            this.settingTab = setting;
        });
        await this.interactionManager.customCommand();
        (await this.interactionManager.customProtyleSlash()).forEach((slash: { filter: string[]; html: string; id: string; callback(protyle: Protyle): void; }) => {
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

    updateProtyleToolbar(toolbar: Array<string | IMenuItem>): Array<string | IMenuItem> {
        toolbar.push("|");
        const LaTexRefTypes = ["eqref", "ref"];
        LaTexRefTypes.forEach(refType => {
            toolbar.push({
                name: `insert-ref-${refType.toLowerCase()}`,
                icon: (refType === "ref") ? "iconLatexRef" : "iconLatexEqref",
                tipPosition: "n",
                tip: refType,
                click: (protyle: Protyle) => {
                    // 获取选中的内容（优先获取HTML，然后转换为Markdown）
                    let selectedMarkdown = '';
                    try {
                        // 尝试获取选中的内容
                        const selection = window.getSelection();
                        // 获取选区中的文本
                        selectedMarkdown = selection ? selection.toString() : '';
                    } catch (error) {
                        console.error('Failed to get selected content:', error);
                    }
                    protyle.insert(`[${refType == "ref" ? "→" : "⇒"}${selectedMarkdown}](latex:\\${refType}{${selectedMarkdown}})`, false, true);
                }
            });
        });
        return toolbar;
    }

    openSetting(): void {
        this.settingTab.openSetting();
    }

    onunload() {
        if (isDev) this.logger.info("插件卸载，plugin=>", this);
    }
}
