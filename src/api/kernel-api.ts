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
   * @param isDir - 是否是文件夹，如果为true则只创建文件夹，忽略文件
   * @param file - 上传的文件
   */
  public putFile(path: string, isDir: boolean, file: any): Promise<SiyuanData> {
    const formData = new FormData();
    formData.append("path", path);
    formData.append("isDir", String(isDir));
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
      const file = new File([new Blob([data])], pathString.split("/").pop()!);
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
  public async getFile(path: string, type: "text" | "json" | "any") {
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
      } else if (type === "json") {
        return await response.json();
      }
      else if (type === "any") {
        return await response;
      }
    } else if (response.status === 202) {
      const data = await response.json() as any;
      switch (data.code) {
        case -1 : { console.error("参数解析错误", {msg: data.msg}); break; }
        case 403 : { console.error("无访问权限 (文件不在工作空间下)", {msg: data.msg}); break; }
        case 404 : { console.error("未找到 (文件不存在)", {msg: data.msg}); break; }
        case 405 : { console.error("方法不被允许 (这是一个目录)", {msg: data.msg}); break; }
        case 500 : { console.error("服务器错误 (文件查询失败 / 文件读取失败)", {msg: data.msg}); break; }
      }
    }else {
      console.error(response);
    }
    return null;
  }

  /**
   * 移动工作空间外的文件
   *
   * @param srcs - 要移动的源文件
   * @param destDir - 工作空间中的目标路径
   */
  public async globalCopyFiles(srcs: string[], destDir: string): Promise<SiyuanData> {
    const params = {
      srcs,
      destDir
    };
    return await this.siyuanRequest("/api/file/globalCopyFiles", params);
  }

  /**
   * 移动工作空间外的文件
   *
   * @param path - 要移动的源文件
   * @param newPath - 工作空间中的目标路径
   */
  public async renameFile(path: string, newPath: string): Promise<SiyuanData> {
    const params = {
      path,
      newPath
    };
    return await this.siyuanRequest("/api/file/renameFile", params);
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
      "stmt": `SELECT * FROM blocks WHERE box like '${notebook}' and hpath like '${hpath}' and type like 'd'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async searchFileWithKey(notebook: string, hpath: string, key: string): Promise<SiyuanData> {
    const params = {
      "stmt": `SELECT * FROM blocks WHERE box like '${notebook}' and hpath like '${hpath}%' and ial like "%custom-literature-key=_${key}%" and type like 'd'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async getLiteratureDocInPath(notebook: string, dir_hpath: string, offset: number, limit: number): Promise<SiyuanData> {
    const params = {
      "stmt": `SELECT 
          b.id, b.root_id, b.box, b."path", b.hpath, b.name, b.content, a.value as literature_key, c.value as literature_unlink
        FROM blocks b 
          left outer join (
            select * FROM "attributes" WHERE name = "custom-literature-key"
          ) as a on b.id = a.block_id 
          left outer join (
            select * FROM "attributes" WHERE name = "custom-literature-unlinked"
          ) as c on b.id = c.block_id 
        WHERE 
          b.box like '${notebook}' and 
          b.hpath like '${dir_hpath}%' and 
          b.type like 'd' limit ${limit}, ${offset}`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async getLiteratureUserData(literatureId: string) {
    const params = {
      "stmt": `select a.block_id from attributes a where 
        name = "custom-literature-block-type" and 
        value = "user data" and 
        root_id = "${literatureId}"`
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

  public async updateBlockContent(blockId: string, dataType: "markdown" | "dom", data: string) {
    const params = {
      "dataType": dataType,
      "data": data,
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

  public async getCitedSpans(blockId: string) {
    const params = {
      "stmt": `SELECT * FROM spans WHERE block_id like '${blockId}' and type like 'textmark block-ref'`
    };
    return await this.siyuanRequest("/api/query/sql", params);
  }

  public async prependBlock(blockId: string, type: "markdown" | "dom", data: string) {
    const params = {
      "data": data,
      "dataType": type,
      "parentID": blockId
    };
    return await this.siyuanRequest("/api/block/prependBlock", params);
  }

  public async appendBlock(blockId: string, type: "markdown" | "dom", data: string) {
    const params = {
      "data": data,
      "dataType": type,
      "parentID": blockId
    };
    return await this.siyuanRequest("/api/block/appendBlock", params);
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

  public async getBlockAttrs(blockId: string): Promise<SiyuanData> {
    const params = {
      "id": blockId
    };
    return await this.siyuanRequest("/api/attr/getBlockAttrs", params);
  }

  public async renameDoc(notebook: string, path: string, title: string) {
    const params = {
      "notebook": notebook,
      "path": path,
      "title": title
    };
    return await this.siyuanRequest("/api/filetree/renameDoc", params);
  }

  public async setBlockKey(blockId: string, key: string): Promise<SiyuanData> {
    const attrParams = {
      "id": blockId,
      "attrs": {
        "custom-literature-key": key
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

  public async setBlockAttr(blockId: string, attrs: {[key: string]: string}): Promise<SiyuanData> {
    const attrParams = {
      "id": blockId,
      "attrs": attrs
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

  public async getAttributeView(avID: string) {
    return await this.siyuanRequest("/api/av/getAttributeView", {id: avID});
  }

  public async getAttributeViewKeys(id: string) {
    return await this.siyuanRequest("api/av/getAttributeViewKeys", {id});
  }

  public async addAttributeViewBlocks(avID: string, srcs: {
    id: string,
    isDetached: boolean
  }[]) {
    return await this.siyuanRequest("/api/av/addAttributeViewBlocks", {
      avID,
      srcs
    })
  }

  public async getAttributeViewBoundBlockIDsByItemIDs(avID: string, itemIDs: string[]) {
    return await this.siyuanRequest("/api/av/getAttributeViewBoundBlockIDsByItemIDs", {
      avID,
      itemIDs
    })
  }

  public async getAttributeViewItemIDsByBoundIDs(avID: string, blockIDs: string[]) {
    return await this.siyuanRequest("/api/av/getAttributeViewItemIDsByBoundIDs", {
      avID,
      blockIDs
    })
  }

  public async setAttributeViewBlockAttr(avID: string, keyID: string, itemID: string,value:any ) {
    return await this.siyuanRequest("/api/av/setAttributeViewBlockAttr", {
      avID,
      keyID,
      itemID,
      value
    })
  }

  public async batchSetAttributeViewBlockAttrs(avID: string, values: {keyID: string, itemID: string, value: any}[] ) {
    return await this.siyuanRequest("/api/av/batchSetAttributeViewBlockAttrs", {
      avID,
      values
    })
  }

  public async setExport(options: object) {
    return await this.siyuanRequest("/api/setting/setExport", options);
  }

  public async exportMDContent(blockID: string, yfm: boolean) {
    const params = {
      "id": blockID,
      "yfm":yfm,
      "fillCSSVar": true
      
    };
    return await this.siyuanRequest("/api/export/exportMdContent", params);
  }

  public async exportResources(paths: string[], name: string) {
    const params = {
      paths,
      name
    };
    return await this.siyuanRequest("/api/export/exportResources", params);
  }

  public async pandoc(dir: string, args: string[]) {
    const params = {dir, args};
    return await this.siyuanRequest("/api/convert/pandoc", params);
  }

  public async renderTemplate(id: string, absPath: string) {
    const params = {
      id, path: absPath
    }
    return await this.siyuanRequest("/api/template/render", params);
  }
}

export default KernelApi;
