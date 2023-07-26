/*
 * Copyright (c) 2023, Terwer . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Terwer designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Terwer in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
 * or visit www.terwer.space if you need additional information or have any
 * questions.
 */

import { BaseApi, type SiyuanData } from "./base-api";
import { siyuanApiToken, siyuanApiUrl } from "../utils/constants";
import { fetchPost } from "siyuan";
/**
 * 思源笔记服务端API v2.8.8
 *
 * @see {@link https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md API}
 *
 * @author terwer
 * @version 1.0.0
 * @since 1.0.0
 */
class KernelApi extends BaseApi {
  /**
   * 列出笔记本
   */
  public async lsNotebooks(): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/notebook/lsNotebooks", {});
  }

  /**
   * 打开笔记本
   *
   * @param notebookId - 笔记本ID
   */
  public async openNotebook(notebookId: string): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/notebook/openNotebook", {
      notebook: notebookId,
    });
  }

  /**
   * 列出文件
   *
   * @param path - 路径
   */
  public async readDir(path: string): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/file/readDir", {
      path: path,
    });
  }

  /**
   * 写入文件
   *
   * @param path - 文件路径，例如：/data/20210808180117-6v0mkxr/20200923234011-ieuun1p.sy
   * @param file - 上传的文件
   */
  public putFile(path: string, file: any): Promise<SiyuanData> {
    const formData = new FormData();
    formData.append("path", path);
    formData.append("isDir", "false");
    formData.append("modTime", Math.floor(Date.now() / 1000).toString());
    formData.append("file", file);

    return new Promise((resolve, reject) => {
      fetchPost("/api/file/putFile", formData, (data) => {
        if (data.code === 0) {
          resolve(data);
        } else {
          reject(data);
        }
      });
    });
  }

  public async saveTextData(fileName: string, data: any) {
    return new Promise((resolve) => {
      const pathString = `/temp/convert/pandoc/${fileName}`;
      const file = new File([new Blob([data])], pathString.split("/").pop());
      const formData = new FormData();
      formData.append("path", pathString);
      formData.append("file", file);
      formData.append("isDir", "false");
      fetchPost("/api/file/putFile", formData, (response) => {
        resolve(response);
      });
    });
  }

  /**
   * 读取文件
   *
   * @param path - 文件路径，例如：/data/20210808180117-6v0mkxr/20200923234011-ieuun1p.sy
   * @param type - 类型
   */
  public async getFile(path: string, type: "text" | "json") {
    const response = await fetch(`${siyuanApiUrl}/api/file/getFile`, {
      method: "POST",
      headers: {
        Authorization: `Token ${siyuanApiToken}`,
      },
      body: JSON.stringify({
        path: path,
      }),
    });
    if (response.status === 200) {
      if (type === "text") {
        return await response.text();
      }
      if (type === "json") {
        return (await response.json()).data;
      }
    }
    return null;
  }

  /**
   * 删除文件
   *
   * @param path - 路径
   */
  public async removeFile(path: string): Promise<SiyuanData> {
    const params = {
      path: path,
    };
    return await this.siyuanRequest("/api/file/removeFile", params);
  }

  /**
   * 通过 Markdown 创建文档
   *
   * @param notebook - 笔记本
   * @param path - 路径
   * @param md - md
   */
  public async createDocWithMd(notebook: string, path: string, md: string): Promise<SiyuanData> {
    const params = {
      notebook: notebook,
      path: path,
      markdown: md,
    };
    return await this.siyuanRequest("/api/filetree/createDocWithMd", params);
  }

  /**
   * 导入 Markdown 文件
   *
   * @param localPath - 本地 MD 文档绝对路径
   * @param notebook - 笔记本
   * @param path - 路径
   */
  public async importStdMd(localPath: string, notebook: string, path: string): Promise<SiyuanData> {
    const params = {
      // Users/terwer/Documents/mydocs/SiYuanWorkspace/public/temp/convert/pandoc/西蒙学习法：如何在短时间内快速学会新知识-友荣方略.md
      localPath: localPath,
      notebook: notebook,
      toPath: path,
    };
    return await this.siyuanRequest("/api/import/importStdMd", params);
  }

  public async deleteBlock(blockId: string) {
    const params = {
      "id": blockId
    };
    return await this.siyuanRequest("/api/block/deleteBlock", params);
  }

  public async searchFileInSpecificPath(notebook: string, hpath: string): Promise<SiyuanData> {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE box LIKE'${notebook}' and hpath LIKE'${hpath}' and type LIKE'd'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async searchFileWithName(notebook: string, hpath: string, name: string): Promise<SiyuanData> {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE box LIKE'${notebook}' and hpath LIKE'${hpath}%' and name LIKE'${name}' and type LIKE'd'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async getFileTitleInPath(notebook: string, dir_hpath: string, offset: number, limit: number): Promise<SiyuanData> {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE box LIKE'${notebook}' and hpath LIKE'${dir_hpath}%' and type LIKE'd' limit ${offset}, ${limit}`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async getBlockContent(blockId: string) {
    const params = {
      "id": blockId
    };
    return await this.siyuanRequest("/api/block/getBlockKramdown", params);
  }

  public async getChidBlocks(blockId: string) {
    const params = {
      "id": blockId
    };
    return await this.siyuanRequest("/api/block/getChildBlocks", params);
  }

  public async updateBlockContent(blockId: string, dataType: "markdown" | "dom", md: string) {
    const params = {
      "dataType": dataType,
      "data": md,
      "id": blockId
    };
    return await this.siyuanRequest("/api/block/updateBlock", params);
  }

  public async getCitedBlocks(fileId: string) {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE root_id like '${fileId}' and type like 'p' and markdown like '%((%))%'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async prependBlock(blockId: string, md: string) {
    const params = {
      "data": md,
      "dataType": "markdown",
      "parentID": blockId
    };
    return await this.siyuanRequest("/api/block/prependBlock", params);
  }

  public async updateCitedBlock(blockId: string, md: string): Promise<SiyuanData> {
    const updateParams = {
      "dataType": "markdown",
      "data": md,
      "id": blockId
    };
    return await this.siyuanRequest("/api/block/updateBlock", updateParams);
  }

  public async getBlock(blockId: string): Promise<SiyuanData> {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE id like '${blockId}'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async renameDoc(notebook: string, path: string, title: string) {
    const params = {
      "notebook": notebook,
      "path": path,
      "title": title
    };
    return await this.siyuanRequest("/api/filetree/renameDoc", params);
  }

  public async setBlockCited(blockId: string, isSet: boolean): Promise<SiyuanData> {
    const attrParams = {
      "id": blockId,
      "attrs": {
        "custom-cited": isSet ? "true" : ""
      }
    };
    return await this.siyuanRequest("/api/attr/setBlockAttrs", attrParams);
  }

  public async setNameOfBlock(blockId: string, name:string){
    const attrParams = {
      "id": blockId,
      "attrs": {
        "name": name
      }
    };
    return await this.siyuanRequest("/api/attr/setBlockAttrs", attrParams);
  }

  public async setBlockEntry(blockId: string, entryData: string): Promise<SiyuanData> {
    const attrParams = {
      "id": blockId,
      "attrs": {
        "custom-entry-data": entryData
      }
    };
    return await this.siyuanRequest("/api/attr/setBlockAttrs", attrParams);
  }

  public async getBlocksWithContent(notebookId: string, fileId: string, content: string) {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE box like '${notebookId}' and root_id like '${fileId}' and type like 'p' and markdown like '${content}'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }
}

export default KernelApi;
