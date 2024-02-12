import type { TEventBus } from "siyuan";
import { createLogger, type ILogger } from "../utils/simple-logger";
import type SiYuanPluginCitation from "../index";
import { isDev, STORAGE_NAME } from "../utils/constants";
import { loadLocalRef } from "../utils/util";

const ruleType = ["GetFromPool", "Refresh"] as const;
type TRuleType = typeof ruleType[number];

interface CustomEventDetail {
  type: string,
  triggerFn: (any) => any
}

interface RefreshEventDetail extends CustomEventDetail {
  type: "database" | "literature note",
  docIDs?: string[]
  keys?: string[]
  refreshAll?: boolean
  confirmUserData?:boolean
}

interface GetEventDetail extends CustomEventDetail {
  keyorid: string
  triggerFn: (idorkey: string) => any
}

export class CustomEventBus {

  private logger: ILogger;

  constructor(private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("Custom EventBus");
    ruleType.forEach(rule => {
      this.plugin.eventBus.on(rule as TEventBus, this.manageRules.bind(this));
    });
  }

  private manageRules(e: CustomEvent<CustomEventDetail>) {
    if (isDev) this.logger.info("EventBus触发，event=>", e);
    switch (e.type as TRuleType) {
      case "GetFromPool": this.getFromPool(e.detail as GetEventDetail); break;
      case "Refresh": this.refresh(e.detail as RefreshEventDetail); break;
    }
  }

  private getFromPool(detail: GetEventDetail) {
    detail.triggerFn(this.plugin.literaturePool.get(detail.keyorid));
  }

  private async refresh(detail: RefreshEventDetail) {
    if (detail.type == "database") {
      await this.plugin.reference.checkRefDirExist();
      return this.plugin.database.buildDatabase(this.plugin.data[STORAGE_NAME].database);
    } else if (detail.type == "literature note") {
      if (detail.refreshAll) {
        this.plugin.reference.refreshLiteratureNoteContents(detail.confirmUserData);
      } else {
        await loadLocalRef(this.plugin);
        if (detail.docIDs) {
          detail.docIDs.forEach(id => {
            this.plugin.reference.refreshSingleLiteratureNote(id, false, detail.confirmUserData);
          });
        }
        if (detail.keys) {
          detail.keys.forEach(key => {
            const id  = this.plugin.literaturePool.get(key);
            this.plugin.reference.refreshSingleLiteratureNote(id, false, detail.confirmUserData);
          });
        }
      }
    }
  }

}