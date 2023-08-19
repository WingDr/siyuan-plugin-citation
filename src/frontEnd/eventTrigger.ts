import type { TEventBus } from "siyuan";
import type SiYuanPluginCitation from "../index";
import { isDev } from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";

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

interface EventQueue {
  type: "repeated" | "once";
  params: {[param: string]: any};
  queue?: QueueT<TriggeredEvent>;
  triggerFns?: ((params: {[param: string]: any}) => any)[];
}

export interface TriggeredEvent {
  triggerFn: (params: {[param: string]: any}) => any;
  params: {[param: string]: any};
  type: "repeated" | "once"
}

// 管理特殊的事件触发
export class EventTrigger {
  private eventQueue: {[name: string]: EventQueue};
  private logger: ILogger;


  constructor(private plugin: SiYuanPluginCitation){
    this.eventQueue = {};
    this.logger = createLogger("event trigger");
    this.plugin.eventBus.on("ws-main", this.wsMainTrigger.bind(this));
  }

  private wsMainTrigger(event: CustomEvent<any>) {
    if ( Object.keys(this.eventQueue).indexOf(event.detail.cmd) != -1 ) {
      if (isDev) this.logger.info("事件触发，event =>", {type: "ws-main", cmd: event.detail.cmd});
      this.execEvent(event.detail.cmd, event);
    }
  }

  public addEventBusEvent(type: TEventBus, event: (e: CustomEvent<any>) => void) {
    this.plugin.eventBus.on(type, event);
  }

  public addSQLIndexEvent(event: TriggeredEvent) {
    this.addEvent("databaseIndexCommit", event);
  }

  private async execEvent(name: string, event: CustomEvent<any>) {
    if (this.eventQueue[name].type == "repeated") {
      const triggerEvent = this.eventQueue[name];
      if (isDev) this.logger.info("事件执行，event=>", {...triggerEvent, name});
      const pList = this.eventQueue[name].triggerFns.map(async (triggerFn) => {
        await triggerFn({...triggerEvent.params, event});
      });
      await Promise.all(pList);
    } else if (this.eventQueue[name].type == "once") {
      let triggerEvent = this.withdrawEvent(name);
      while (triggerEvent) {
        if (isDev) this.logger.info("事件执行，event=>", {...triggerEvent, name});
        await triggerEvent.triggerFn({...triggerEvent.params, event});
        triggerEvent = this.withdrawEvent(name);
      }
    }
    if (isDev) this.logger.info("事件执行完毕");
  }

  public addEvent(name: string, event: TriggeredEvent) {
    if (isDev) this.logger.info(`向触发队列${name}中添加事件, queue=>`, this.eventQueue[name]);
    if (!this.eventQueue[name]) {
      if (isDev) this.logger.info(`新建触发队列${name}`);
      this.eventQueue[name] = {
        type: event.type,
        queue: new QueueT<TriggeredEvent>,
        triggerFns: [],
        params: event.params
      };
    }
    if (event.type == "once") this.eventQueue[name].queue.push(event);
    else if (event.type == "repeated") this.eventQueue[name].triggerFns.push(event.triggerFn);
  }

  private withdrawEvent(name: string): undefined | TriggeredEvent {
    return this.eventQueue[name]?.queue?.pop();
  }
}