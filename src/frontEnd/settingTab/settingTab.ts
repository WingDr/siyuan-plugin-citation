import { Dialog } from "siyuan";

import { createLogger, type ILogger } from "../../utils/simple-logger";
import type SiYuanPluginCitation from "../../index";
import ExampleComponent from "./Example.svelte";
import { isDev } from "../../utils/constants";

export class SettingTab {
  private logger: ILogger;

  constructor(private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("setting tab");
  }

  public openSetting() {
    const id = `dialog-search-${Date.now()}`;
    const settingTab = new Dialog({
      content: `<div id="${id}" class="b3-dialog__body"/>`,
      destroyCallback: () => {if (isDev) this.logger.info("关闭搜索界面");}
    });

    const component = new ExampleComponent({
      target: settingTab.element.querySelector(`#${id}`),
    });
  }
}