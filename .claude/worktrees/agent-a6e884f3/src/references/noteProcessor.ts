import type SiYuanPluginCitation from "../index";
import { createLogger, type ILogger } from "../utils/simple-logger";

export class NoteProcessor {
    private logger: ILogger;

    constructor(private plugin: SiYuanPluginCitation) {
        this.logger = createLogger("note processor")
    }

    public async processNote(noteContent: string): Promise<string> {
        let resContent = noteContent;
        const imgReg = /<img.*data-attachment-key=\"(.*?)\".*?>/;
        let iter = 0;
        while (resContent.match(imgReg)) {
            const match = resContent.match(imgReg);
            const itemKey = match![1];
            const detail = await this.plugin.database.getAttachmentByItemKey(itemKey);
            detail.annotationType = detail.itemType;
            const link = await this.plugin.reference.moveImgToAssets(detail.path, detail, "html");
            resContent = resContent.replace(match![0], link);
            iter = iter + 1;
            if (iter == 20) break;
        }
        return resContent;
    }
}