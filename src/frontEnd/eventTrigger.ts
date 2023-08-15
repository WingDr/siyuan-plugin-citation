import type { TEventBus } from "siyuan";
import type SiYuanPluginCitation from "../index";
import { isDev } from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";

const eventTypes = ["database-index-commit"] as const;
export type EventType = typeof eventTypes[number];

class QueueT<T> {
  private data: Array<T>;
  constructor() {this.data = new Array<T>;}
  push = (item: T) => this.data.push(item);
  pop = (): T|undefined => {
    if (!this.data.length) return undefined;
    else {
      const result = this.data[0];
      this.data = this.data.slice(1);
      return result;
    }
  };
}

export interface TriggeredEvent {
  triggerFn: (params: {[param: string]: any}) => any;
  params: {[param: string]: any};
}

// 管理特殊的事件触发
export class EventTrigger {
  private eventQueue: {[name: string]: QueueT<any>};
  private logger: ILogger;


  constructor(private plugin: SiYuanPluginCitation){
    this.eventQueue = {};
    this.logger = createLogger("event trigger");
    this.plugin.eventBus.on("ws-main", this.wsMainTrigger.bind(this));
  }

  private wsMainTrigger(event: CustomEvent<any>) {
    if (event.detail.cmd === "databaseIndexCommit") {
      if (isDev) this.logger.info("事件触发，event =>", {type: "ws-main", cmd: "databaseIndexCommit"});
      this.execEvent("database-index-commit");
    }
  }

  public addEventBusEvent(type: TEventBus, event: (e: CustomEvent<any>) => void) {
    this.plugin.eventBus.on(type, event);
  }

  public addSQLIndexEvent(event: TriggeredEvent) {
    this.addEvent("database-index-commit", event);
  }

  private async execEvent(name: EventType) {
    let event = this.withdrawEvent(name);
    while (event) {
      if (isDev) this.logger.info("事件执行，event=>", event);
      await event.triggerFn(event.params);
      event = this.withdrawEvent(name);
    }
    if (isDev) this.logger.info("事件执行完毕");
  }

  private addEvent(name: EventType, event: TriggeredEvent) {
    if (isDev) this.logger.info(`向触发队列${name}中添加事件, queue=>`, this.eventQueue[name]);
    if (!this.eventQueue[name]) {
      if (isDev) this.logger.info(`新建触发队列${name}`);
      this.eventQueue[name] = new QueueT<TriggeredEvent>;
    }
    this.eventQueue[name].push(event);
  }

  private withdrawEvent(name: EventType): undefined | TriggeredEvent {
    return this.eventQueue[name]?.pop();
  }
}