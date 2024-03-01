import SiYuanPluginCitation from "../index";
import { type ILogger, createLogger } from "../utils/simple-logger";

export class LiteratureNote {
    plugin: SiYuanPluginCitation;
    private logger: ILogger;

    constructor(plugin: SiYuanPluginCitation) {
        this.plugin = plugin;
        this.logger = createLogger("literature-note");
    }

}