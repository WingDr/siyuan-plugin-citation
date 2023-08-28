import { sleep } from "../utils/util";
import type SiYuanPluginCitation from "../index";
import axios from "axios";


export class NetworkMananger {

  private reqNum;

  constructor(private plugin: SiYuanPluginCitation, private reqLimit: number) {
    this.reqNum = 0;
  }

  public async sendRequest(reqOpt: {method: string, url: string, headers: any, data: string}) {
    while (this.reqNum >= this.reqLimit) {
      await sleep(500);
    }
    this.reqNum += 1;
    const res = await axios(reqOpt);
    this.reqNum -= 1;
    return res;
  }

  public async sendNetworkMission(params: any[], missionFn) {
    while (this.reqNum >= this.reqLimit) {
      await sleep(500);
    }
    this.reqNum += 1;
    const res = await missionFn(...params);
    this.reqNum -= 1;
    return res;
  }
}