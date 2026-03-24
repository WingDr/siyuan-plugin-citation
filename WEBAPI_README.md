# Zotero Web API 模式说明

## 概述

本次更新添加了对 Zotero 7 本地 Web API 的支持，作为现有 debug-bridge 模式的替代方案。

**重要**: Web API 模式**强制使用 itemKey 作为索引**，无需安装 Better BibTeX 等第三方插件。

## 新增功能

### 1. 新的数据库类型选项
- **Zotero (Web API)** - 使用 Zotero 7 本地 Web API 访问 Zotero 数据
- **Juris-M (Web API)** - 使用 Juris-M 本地 Web API 访问 Juris-M 数据

### 2. 核心特性

#### ZoteroWebAPIModal 类
新增的 `ZoteroWebAPIModal` 类提供以下功能：

1. **连接检测**
   - 自动检测 Zotero 是否运行
   - 通过 `http://localhost:23119/api/` 访问本地 API

2. **数据获取**
   - 获取所有文献项 (items)
   - 获取单个文献项详情
   - 获取附件 (attachments)
   - 获取笔记 (notes)
   - 获取注释 (annotations)

3. **搜索功能**
   - 集成 Fuse.js 搜索引擎
   - 支持按标题、作者、年份搜索
   - 自动过滤附件、笔记、注释类型的项

4. **数据转换**
   - 将 Web API 返回的数据格式转换为 `EntryDataZotero` 格式
   - 兼容现有的 `EntryZoteroAdapter`
   - 支持 itemKey 作为索引

## 使用方法

### 1. 配置步骤

1. 确保 Zotero 7 已安装并运行
2. 在思源插件设置中选择数据库类型：
   - 基本设置 → 数据库类型 → 选择 "Zotero (Web API)"
3. 如需使用 itemKey 作为索引，勾选"使用 itemKey 作为索引"选项

### 2. API 端点说明

本地 Web API 使用以下端点：

- **基础 URL**: `http://localhost:23119/api/`
- **用户 ID**: 本地访问使用 `0`
- **API 版本**: 需要在请求头中设置 `Zotero-API-Version: 3`

#### 主要端点：

1. **获取所有 items**
   ```
   GET /api/users/0/items?limit=100&itemType=-attachment || -note || -annotation
   ```

2. **获取单个 item**
   ```
   GET /api/users/0/items/{itemKey}
   ```

3. **获取 item 的 children (附件和笔记)**
   ```
   GET /api/users/0/items/{itemKey}/children
   ```

### 3. 数据格式

#### 返回的 item 结构：
```json
{
  "key": "ITEMKEY",
  "version": 1234,
  "library": {
    "type": "user",
    "id": 6690314,
    "name": "我的文库"
  },
  "data": {
    "itemType": "journalArticle",
    "title": "文章标题",
    "creators": [...],
    "date": "2024",
    "DOI": "10.xxxx/xxxx",
    ...
  }
}
```

## 与 debug-bridge 模式的区别

| 特性 | Web API 模式 | debug-bridge 模式 |
|------|-------------|-------------------|
| **依赖** | 仅需 Zotero 7 | 需要 debug-bridge 插件 |
| **认证** | 无需密码 | 需要配置密码 |
| **数据访问** | REST API | JavaScript 执行 |
| **性能** | 较快 | 较慢 |
| **稳定性** | 更稳定 | 依赖插件 |
| **索引方式** | **仅 itemKey** | itemKey 或 citekey 可选 |
| **第三方依赖** | **无** | 可选 Better BibTeX |

## 实现细节

### 关键代码文件

1. **src/database/modal.ts**
   - 新增 `ZoteroWebAPIModal` 类
   - 实现数据获取和转换逻辑

2. **src/database/database.ts**
   - 在 `buildDatabase` 方法中添加 Web API 模式支持

3. **src/utils/constants.ts**
   - 添加新的数据库类型选项

4. **src/frontEnd/settingTab/settingTabComponent.svelte**
   - 更新设置界面以支持 Web API 模式

### 主要方法

#### ZoteroWebAPIModal 类方法：

- `checkZoteroRunning()`: 检查 Zotero 是否运行
- `getAllItems()`: 获取所有文献项
- `getItemByItemKey()`: 获取单个文献项
- `getChildrenByItemKey()`: 获取附件和笔记
- `getNotesByItemKey()`: 获取笔记
- `_convertWebAPIItemToZoteroData()`: 数据格式转换

## 测试

### 功能测试结果

```
✓ Zotero Web API 可访问
✓ 获取所有items
✓ 获取单个item详情
✓ 获取item的children (附件和笔记)
✓ 过滤功能正常
```

### 手动测试命令

```bash
# 测试连接
curl "http://localhost:23119/api/users/0/items?limit=1" -H "Zotero-API-Version: 3"

# 获取items
curl "http://localhost:23119/api/users/0/items?limit=10" -H "Zotero-API-Version: 3"

# 获取单个item
curl "http://localhost:23119/api/users/0/items/ITEMKEY" -H "Zotero-API-Version: 3"

# 获取children
curl "http://localhost:23119/api/users/0/items/ITEMKEY/children" -H "Zotero-API-Version: 3"
```

## 已知限制

1. **只读访问**: 当前实现仅支持读取数据，不支持修改 Zotero 数据
2. **注释支持**: 注释 (annotations) 功能暂未完全实现
3. **Citation Key**: 从 `extra` 字段中提取，需要 Better BibTeX 生成

## 未来改进

- [ ] 实现注释 (annotations) 的完整支持
- [ ] 添加数据修改功能 (tags, backlinks)
- [ ] 优化批量数据获取性能
- [ ] 添加缓存机制

## 参考文档

- [Zotero Web API v3 文档](https://www.zotero.org/support/dev/web_api/v3/basics)
- [Zotero 本地 API](https://www.zotero.org/support/dev/web_api/v3/basics#local_api)
