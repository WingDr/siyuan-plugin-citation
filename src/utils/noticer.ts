import { showMessage } from "siyuan";

export interface INoticer {
  info: (msg: string, obj?: any) => void
  error: (msg: string | Error, obj?: any) => void
}

export const createNoticer = (): INoticer => {
  const sign = "siyuan-citation-plugin";

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const log = (level: "info" | "error", msg: any, timeout: number, obj?: any) => {
    const time = formatDate(new Date());
    if (obj) {
      let finalMsg = msg as string;
      Object.keys(obj).forEach(key => {
        finalMsg = finalMsg.replaceAll(`$\{${key}\}`, obj[key]);
      });
      showMessage(`[${sign}] [${time}] ${finalMsg}`, timeout, level);
    } else {
      showMessage(`[${sign}] [${time}] ${msg}`, timeout, level);
    }
  };

  return {
    info: (msg: string, obj?: any) => log("info", msg, 2000, obj),
    error: (msg: string | Error, obj?: any) => {
      if (typeof msg == "string") {
        log("error", msg, 0, obj);
      } else {
        showMessage(`[${sign}] [${formatDate(new Date())}] error occurred\n` + JSON.stringify(msg), 0, "error");
      }
    },
  };
};