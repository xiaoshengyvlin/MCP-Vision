# MCP-Vision

基于 [goehou/Visual-Enhancement-mcp](https://github.com/goehou/Visual-Enhancement-mcp)（MIT）魔改的 MCP 服务，接入 OpenAI 兼容 API，提供看图、识字、生图。

## 工具

| 工具 | 做什么 |
| --- | --- |
| `vision_analyze` | 通用图片理解 |
| `vision_ocr` | 逐字提取图片文字 |
| `image_generate` | 文本生成图片（多张/尺寸/模型覆盖） |

图片传法三选一：`imagePath`（本地路径）/ `imageUrl` / `imageBase64` + `imageMediaType`。

## 配置

模型优先级：调用时传 `model` > 工具专用 > 全局默认。

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VISION_API_BASE_URL` | 视觉 API 根地址 | 必填 |
| `VISION_API_KEY` | 视觉 Key | 必填 |
| `VISION_MODEL` | 默认视觉模型 | 必填 |
| `VISION_ANALYZE_MODEL` | analyze 专用模型 | 回退 `VISION_MODEL` |
| `VISION_BACKUP_API_BASE_URL` | ocr 备用视觉平台地址 | 回退 `VISION_API_BASE_URL` |
| `VISION_BACKUP_API_KEY` | ocr 备用视觉 Key | 回退 `VISION_API_KEY` |
| `VISION_BACKUP_MODEL` | ocr 备用视觉模型 | 回退 `VISION_MODEL` |
| `IMAGE_API_BASE_URL` | 生图 API 根地址 | 回退 `VISION_API_BASE_URL` |
| `IMAGE_API_KEY` | 生图 Key | 回退 `VISION_API_KEY` |
| `IMAGE_MODEL` | 生图模型 | 回退 `VISION_MODEL` |
| `VISION_TIMEOUT_MS` | 视觉超时（毫秒） | `60000` |
| `IMAGE_TIMEOUT_MS` | 生图超时（毫秒） | `120000` |

OpenCode 配置：

```json
{
  "mcp": {
    "vision": {
      "type": "local",
      "command": ["mcp-vision-server"],
      "environment": {
        "VISION_API_BASE_URL": "...",
        "VISION_API_KEY": "...",
        "VISION_MODEL": "...",
        "IMAGE_API_BASE_URL": "...",
        "IMAGE_API_KEY": "...",
        "IMAGE_MODEL": "..."
      },
      "enabled": true
    }
  }
}
```

## 相比原项目

- 新增 `image_generate` 生图工具（多张/尺寸/模型覆盖，URL 下载加固）
- 新增 `VISION_BACKUP_*` 备用视觉端点
- 新增 `VISION_ANALYZE_MODEL` 工具级模型覆盖
- 加固：仅允许 http/https 下载、base64 大小上限、错误信息截断、多图全返回、空配置可启动

## 安装

```bash
# 方式一：本地克隆后安装
git clone https://github.com/xiaoshengyvlin/MCP-Vision.git
cd MCP-Vision
npm install -g .

# 方式二：tarball 安装
npm pack && npm install -g mcp-vision-server-0.1.4.tgz
```

# AI 安装（推荐）
帮我安装这个项目：https://github.com/xiaoshengyvlin/MCP-Vision
