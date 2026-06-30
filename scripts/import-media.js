import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, parse, relative, sep } from "node:path";

const mediaRoot = join(process.cwd(), "public", "media");
const videosRoot = join(mediaRoot, "videos");
const manifestPath = join(mediaRoot, "manifest.json");
const cloudSourcesPath = join(mediaRoot, "sources.json");
const videoExts = new Set([".mp4", ".webm", ".m4v", ".mov", ".m3u8"]);
const imageExts = [".jpg", ".jpeg", ".png", ".webp"];

mkdirSync(videosRoot, { recursive: true });

function toPublicPath(filePath) {
  return `/${relative(join(process.cwd(), "public"), filePath)
    .split(sep)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }
}

function findPoster(videoPath) {
  const { dir, name } = parse(videoPath);
  for (const ext of imageExts) {
    const candidate = join(dir, `${name}${ext}`);
    if (existsSync(candidate)) return toPublicPath(candidate);
  }
  return "/assets/hero-poster.png";
}

const localItems = walk(videosRoot)
  .filter((file) => videoExts.has(extname(file).toLowerCase()))
  .map((file, index) => {
    const { name } = parse(file);
    const cleanTitle = name.replace(/[-_]+/g, " ").trim();
    return {
      id: slugify(name) || `local-video-${index + 1}`,
      title: cleanTitle || `本地动画 ${index + 1}`,
      subtitle: "本地导入",
      category: "本地资源",
      status: index < 6 ? "hot" : "archive",
      year: "2026",
      rating: "16+",
      duration: "待整理",
      image: findPoster(file),
      video: toPublicPath(file),
      match: Math.max(72, 98 - index),
      label: index < 3 ? "新导入" : "片库",
      progress: 0,
      description: "从本地媒体目录批量导入的动画资源。",
      tags: index < 6 ? ["推荐热门"] : ["随机推荐"],
    };
  });

const cloudSources = readJson(cloudSourcesPath, { items: [] });
const cloudItems = Array.isArray(cloudSources.items)
  ? cloudSources.items.map((item, index) => ({
      id: item.id || slugify(item.title || `cloud-video-${index + 1}`),
      title: item.title || `云端动画 ${index + 1}`,
      subtitle: item.subtitle || "云端导入",
      category: item.category || "云端资源",
      status: item.status || "hot",
      year: item.year || "2026",
      rating: item.rating || "16+",
      duration: item.duration || "待整理",
      image: item.image || "/assets/hero-poster.png",
      video: item.video || "",
      externalUrl: item.externalUrl || "",
      match: Number(item.match ?? 88),
      label: item.label || "云端",
      progress: Number(item.progress ?? 0),
      description: item.description || "从云端资源清单导入的动画。",
      tags: Array.isArray(item.tags) ? item.tags : ["推荐热门"],
    }))
  : [];

const previousManifest = readJson(manifestPath, { items: [] });
const shouldKeepFallback = localItems.length === 0 && cloudItems.length === 0;
const persistentItems = (previousManifest.items || []).filter((item) =>
  ["netdisk", "public-share"].includes(item.sourceKind)
);
const items = shouldKeepFallback ? previousManifest.items || [] : [...persistentItems, ...localItems, ...cloudItems];

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      sourceRoots: previousManifest.sourceRoots || [],
      items,
    },
    null,
    2
  )}\n`
);

console.log(`Imported ${items.length} media item(s) into ${manifestPath}`);
if (shouldKeepFallback) {
  console.log("No files or cloud sources found; kept the existing manifest.");
}
