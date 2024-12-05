import { Dialog } from "siyuan";
import { mount, unmount } from "svelte";

import { createLogger, type ILogger } from "../../utils/simple-logger";
import type SiYuanPluginCitation from "../../index";
import SettingTabComponent from "./settingTabComponent.svelte";
import { isDev } from "../../utils/constants";
import { type DatabaseType } from "../../database/database";

export class SettingTab {
  private logger: ILogger;

  constructor(private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("setting tab");
  }

  public openSetting() {
    const id = `dialog-setting-${Date.now()}`;
    const settingTab = new Dialog({
      content: `<div id="${id}" class="b3-dialog__body"/>`,
      width: this.plugin.isMobile ? "92vw" : "850px",
      height: "70vh",
      destroyCallback: () => { if (component) unmount(component) }
    });

    const props = {
      plugin: this.plugin,
      logger: this.logger,
      reloadDatabase: async (database: string) => {
        if (isDev) this.logger.info("reload database");
        await this.plugin.database.buildDatabase(database as DatabaseType);
        return await this.plugin.reference.checkRefDirExist();
      },
      refreshLiteratureNoteTitle: async (titleTemplate: string) => {
        if (isDev) this.logger.info("refresh literature note title");
        return this.plugin.reference.refreshLiteratureNoteTitles(titleTemplate);
      }
    };
    const component = mount(SettingTabComponent, {
      target: settingTab.element.querySelector(`#${id}`)!,
      props,
    })
  }
}