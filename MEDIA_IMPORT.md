# 动画资源导入方案

这个项目现在支持三种导入方式：

1. 本地批量导入：把视频文件放进 `public/media/videos/`，运行 `npm run import:media`。
2. 云端直链导入：把可直接播放的 `mp4` / `webm` / `m3u8` 地址写进 `public/media/sources.json`，运行 `npm run import:media`。
3. 公开分享采集：把公开或已授权的网盘分享链接写进 `public/media/public-shares.json`，运行 `npm run import:public-shares`。
4. OpenList 导入：用 OpenList Desktop 的 rclone 配置列出夸克挂载资源，运行 `npm run import:openlist`。

生成后的片库文件是 `public/media/manifest.json`，页面会读取它并渲染卡片，点击卡片即可播放。

## 网盘挂载导入

前端网页不能直接读取你的夸克网盘账号或系统目录，所以推荐先把夸克网盘同步/挂载到本机目录，再让 Node 脚本扫描这个目录。

示例：

```bash
npm run import:netdisk -- --source "/Users/kiwei/Movies/QuarkAnime"
```

默认行为：

- 扫描指定目录下的 `mp4`、`webm`、`mkv`、`mov`、`avi` 等视频。
- 在 `public/media/mounted/` 里建立符号链接，不复制大视频文件。
- 在 `public/media/covers/` 里生成封面。
- 根据文件名访问豆瓣搜索，尽量识别标题、年份、评分、简介和类型标签。
- 将结果写入 `public/media/manifest.json`，刷新网页即可看到。

如果你希望把视频复制到项目里而不是符号链接：

```bash
npm run import:netdisk -- --source "/Users/kiwei/Movies/QuarkAnime" --copy
```

如果豆瓣临时访问失败，或你只想快速导入本地资源：

```bash
npm run import:netdisk -- --source "/Users/kiwei/Movies/QuarkAnime" --no-douban
```

如果资源非常多，可以限制本次扫描数量：

```bash
npm run import:netdisk -- --source "/Users/kiwei/Movies/QuarkAnime" --limit 100
```

## OpenList 播放导入

OpenList 的系统挂载目录可能在 macOS 上枚举很慢，项目现在优先走 OpenList Desktop 自带的 rclone。

先启动只读视频流服务：

```bash
npm run serve:openlist
```

再导入可被浏览器直接播放的 `mp4` / `webm` / `m4v` / `mov`：

```bash
npm run import:openlist
```

页面会按文件夹聚合成资源卡片，每个文件会成为一集。播放时必须保持 `npm run serve:openlist` 运行。

补充萌娘百科公开元数据：

```bash
npm run enrich:moegirl
```

萌娘百科 API 对匿名请求可能不可用，所以脚本读取公开 HTML 的 `og:image`、`og:description` 等元信息，并带本地缓存。

## 本地目录

推荐结构：

```text
public/media/videos/
  Cyber Anime 01.mp4
  Cyber Anime 01.jpg
  Cyber Anime 02.webm
  Cyber Anime 02.png
```

同名图片会自动作为封面。没有封面时会使用默认海报。

## 云端资源

复制 `public/media/sources.example.json` 为 `public/media/sources.json`，按下面格式填写：

```json
{
  "items": [
    {
      "id": "my-anime-01",
      "title": "我的动画 01",
      "category": "追番",
      "image": "/assets/hero-poster.png",
      "video": "https://your-direct-video-url.mp4",
      "externalUrl": "https://pan.quark.cn/s/xxxx",
      "tags": ["追番", "推荐热门"]
    }
  ]
}
```

夸克网盘的普通分享页通常不是视频直链，浏览器播放器不能直接拿它当 `<video>` 播放。可行路径是：

- 用夸克同步/下载到本地，再运行 `npm run import:netdisk -- --source "目录"`。
- 如果你能拿到临时可访问的视频直链，把它写到 `video` 字段。
- 如果后续要做自动登录、转存、取下载链接，需要单独加后端服务处理鉴权，不建议把账号凭据放进前端。

请只导入你拥有播放、展示或备份权限的资源。

## 公开网盘资源采集

复制示例文件：

```bash
cp public/media/public-shares.example.json public/media/public-shares.json
```

填写公开或已授权的分享链接：

```json
{
  "items": [
    {
      "url": "https://pan.quark.cn/s/xxxx",
      "title": "我的公开分享动画",
      "type": "科幻机甲",
      "season": "一月新番",
      "year": "2026",
      "tags": ["推荐热门", "授权"]
    },
    {
      "url": "https://example.com/video.mp4",
      "title": "可直接播放的公开视频",
      "type": "热血战斗",
      "season": "4 月新番",
      "year": "2025"
    }
  ]
}
```

运行采集：

```bash
npm run import:public-shares
```

脚本会读取公开页面可见的 `title`、`og:description`、`og:image` 等元信息，补充到 `manifest.json`。如果 `url` 或 `video` 是浏览器能直接访问的 `mp4` / `webm` / `m3u8`，页面会站内播放；如果只是普通网盘分享页，页面会显示“打开公开分享”，不会尝试绕过登录、提取受保护链接或抓取账号内资源。

常用参数：

```bash
npm run import:public-shares -- --source "/path/to/public-shares.json"
npm run import:public-shares -- --limit 100
npm run import:public-shares -- --no-fetch
```
