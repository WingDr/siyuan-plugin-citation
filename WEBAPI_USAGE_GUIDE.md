# Zotero Web API 模式使用指南

## 快速开始

### 前置要求

1. **Zotero 7** 已安装并运行
2. **思源笔记** 已安装此插件
3. ~~Better BibTeX 插件~~ **不需要！**

**重要说明**: Web API 模式**强制使用 itemKey 作为索引**，无需安装任何第三方插件。这是为了保持简单、稳定、无依赖的设计理念。

### 配置步骤

#### 1. 打开插件设置

在思源笔记中：
1. 点击顶部工具栏的"插件"图标
2. 找到"Citation"插件
3. 点击设置图标

#### 2. 配置数据库类型

在"基本设置"标签页：
1. **选择笔记本**: 选择存储文献笔记的笔记本
2. **设置文献库路径**: 例如 `/References/`
3. **数据库类型**: 选择 **"Zotero (Web API)"**
4. ~~使用 itemKey 作为索引~~: Web API 模式自动使用 itemKey（无需勾选，选项会被禁用）

#### 3. 重新载入数据库

点击"重新载入数据库"按钮，等待加载完成。

## 使用功能

### 1. 插入引用链接

**方法一：使用快捷键**
1. 在文档中输入 `/cite` 或使用快捷键
2. 在弹出的搜索框中输入关键词（标题、作者、年份）
3. 选择文献条目
4. 引用链接将自动插入

**方法二：从 Zotero 插入**
1. 在思源笔记中使用"插入引用"命令
2. 搜索并选择文献
3. 选择引用类型（如果配置了多种类型）

### 2. 创建文献笔记

1. 搜索并选择文献
2. 系统会根据模板自动生成文献笔记
3. 包含以下内容：
   - 标题、作者、年份
   - 摘要
   - DOI、URL等元数据
   - 附件链接
   - Zotero定位链接

### 3. 插入笔记内容

如果文献在 Zotero 中有笔记：
1. 使用"插入笔记"功能
2. 选择文献
3. 所有笔记内容将被插入到当前文档

## 配置模板

### 引用链接模板

在"思源内容模板 → 引用链接"中配置：

**默认模板**: `({{shortAuthor}} {{year}})`

**示例输出**: `(Smith et al. 2024)`

**可用变量**:
- `{{shortAuthor}}`: 简化作者名
- `{{year}}`: 年份
- `{{title}}`: 标题
- `{{citekey}}`: Citation Key
- `{{itemKey}}`: Zotero Item Key

### 文献内容模板

在"思源内容模板 → 文献内容"中配置：

```markdown
---
**Title**: {{title}}
**Author**: {{authorString}}
**Year**: {{year}}
**DOI**: {{DOI}}
---

# Abstract

{{abstract}}

# Files

{{files}}

# Select on Zotero

[Open in Zotero]({{zoteroSelectURI}})

# Notes

{{note}}
```

## 常见问题

### Q1: "Zotero 未运行"错误

**解决方法**:
1. 确保 Zotero 7 已打开
2. 检查 Zotero 是否在 23119 端口运行
3. 尝试在浏览器访问: `http://localhost:23119/api/users/0/items?limit=1`

### Q2: Web API 模式可以使用 Citation Key 吗？

**回答**: 不可以。Web API 模式强制使用 itemKey 以保持简单和稳定。

- **itemKey**: Zotero 内置，永不改变，无需任何插件
- **如果需要 Citation Key**: 请选择 debug-bridge 模式

### Q3: 附件链接无法打开

**解决方法**:
1. 检查附件是否存在于 Zotero 存储目录
2. 使用"在 Zotero 中定位"链接跳转到 Zotero 查看附件
3. 附件链接格式: `file:///path/to/file.pdf`

### Q4: 搜索速度慢

**解决方法**:
1. Web API 模式首次加载会获取所有文献，可能需要一些时间
2. 如果文献库很大（>1000条），首次加载后会缓存，后续搜索会更快
3. 性能测试显示：获取100条items约0.13秒

## 技术细节

### itemKey 说明

Web API 模式使用 Zotero 内置的 **Item Key** 作为唯一标识符：

**特点**:
- **格式**: 8位字母数字组合（如 `BNQ6EZIN`）
- **完整索引**: `{libraryID}_{itemKey}`（如 `6690314_BNQ6EZIN`）
- **自动生成**: 创建文献时 Zotero 自动分配
- **永不改变**: 即使修改文献信息也不会变
- **全局唯一**: 在同一个 Zotero 账户中唯一
- **无需插件**: Zotero 原生功能

### 与 debug-bridge 模式的比较

| 特性 | Web API 模式 | debug-bridge 模式 |
|------|--------------|-------------------|
| **索引方式** | 仅 itemKey | itemKey 或 Citation Key |
| **依赖** | 无 | 可选 Better BibTeX |
| **复杂度** | 低 | 中等 |
| **稳定性** | 高 | 中等 |
| **推荐场景** | 新用户、追求稳定 | LaTeX 用户、已用 BBT |

### API 请求示例

```bash
# 获取所有文献
curl "http://localhost:23119/api/users/0/items?limit=100" \
  -H "Zotero-API-Version: 3"

# 获取单个文献
curl "http://localhost:23119/api/users/0/items/BNQ6EZIN" \
  -H "Zotero-API-Version: 3"

# 获取附件和笔记
curl "http://localhost:23119/api/users/0/items/BNQ6EZIN/children" \
  -H "Zotero-API-Version: 3"
```

### 数据索引格式

使用 itemKey 模式时，文献的唯一标识符格式为：
```
{libraryID}_{itemKey}
```

例如: `6690314_BNQ6EZIN`

这确保了即使在多个文库中也能正确识别文献。

## 高级配置

### 多种引用类型

在"引用链接"设置中，可以配置多种引用类型：

1. 点击"添加"按钮创建新的引用类型
2. 为每种类型配置：
   - 名称（如"脚注"、"正文"）
   - 引用模板
   - shortAuthor 限制
   - 多文献引用的前缀、连接符、后缀

3. 如果不勾选"直接使用第一种引用类型"，插入引用时会弹出选择菜单

### 自定义锚文本

- **静态锚文本**: 引用文本固定，不随文献信息更新
- **动态锚文本**: 引用文本会随文献信息更新（需要刷新）

## 性能优化建议

1. **首次加载**: 文献库较大时，首次加载需要时间，请耐心等待
2. **搜索优化**: 使用具体的关键词可以更快找到文献
3. **缓存**: 已加载的文献数据会缓存，重复使用不需要重新请求

## 支持与反馈

如有问题或建议，请访问：
- GitHub Issues: https://github.com/WingDr/siyuan-plugin-citation/issues
- 邮件: siyuan_citation@126.com
