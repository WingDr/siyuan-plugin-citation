import type { TEventBus } from "siyuan";
import type SiYuanPluginCitation from "../index";
import { isDev } from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { CustomEventBus } from "./customEventBus";

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
  private customEvent: CustomEventBus;
  private onProcessing: boolean;


  constructor(private plugin: SiYuanPluginCitation){
    this.eventQueue = {};
    this.onProcessing = false;
    this.logger = createLogger("event trigger");
    this.plugin.eventBus.on("ws-main", this.wsMainTrigger.bind(this));
    this.customEvent = new CustomEventBus(this.plugin);
  }

  private wsMainTrigger(event: CustomEvent<any>) {
    if (this.onProcessing) return;
    // if (isDev) this.logger.info("触发器运行中");
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
    this.onProcessing = true;
    if (this.eventQueue[name].type == "repeated") {
      const triggerEvent = this.eventQueue[name];
      if (isDev) this.logger.info("事件执行，event=>", {...triggerEvent, name});
      const pList = this.eventQueue[name].triggerFns.map(async (triggerFn) => {
        await triggerFn({...triggerEvent.params, event});
      });
      await Promise.all(pList);
    } else if (this.eventQueue[name].type == "once") {
      const triggerEvents = [];
      let triggerEvent = this.withdrawEvent(name);
      while (triggerEvent) {
        triggerEvents.push(triggerEvent);
        triggerEvent = this.withdrawEvent(name);
      }
      const pList = triggerEvents.map( (tre:TriggeredEvent) => {
        if (isDev) this.logger.info("事件执行，event=>", {...tre, name});
        return new Promise( async (resolve, ) => {
          resolve(await tre.triggerFn({...tre.params, event}));
        });
      });
      await Promise.all(pList);
    }
    if (isDev) this.logger.info("事件执行完毕");
    this.onProcessing = false;
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