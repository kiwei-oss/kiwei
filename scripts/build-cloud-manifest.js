import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import { fallbackCatalog } from "../src/data/fallbackCatalog.js";

const mediaRoot = join(process.cwd(), "public", "media");
const sourceManifestPath = join(mediaRoot, "manifest.json");
const outputManifestPath = join(mediaRoot, "cloud-manifest.json");

const sourceManifest = readJson(sourceManifestPath, { version: 1, items: [] });
const sourceItems = Array.isArray(sourceManifest.items) ? sourceManifest.items : [];
const uploadableItems = sourceItems.filter((item) => item.sourceKind === "local-openlist" && item.sourcePath);
const items = uploadableItems.length > 0 ? uploadableItems.map(toCloudItem) : fallbackCatalog;

mkdirSync(mediaRoot, { recursive: true });
writeFileSync(
  outputManifestPath,
  `${JSON.stringify(
    {
      version: 1,
      generatedFor: "cloudflare-pages",
      generatedAt: new Date().toISOString(),
      source: uploadableItems.length > 0 ? "local-openlist-r2" : "fallback",
      items,
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${items.length} cloud item(s) to ${outputManifestPath}`);

function toCloudItem(item, index) {
  const episodes = Array.isArray(item.episodeSources) ? item.episodeSources : [];
  const cloudEpisodes = episodes.map((episode, episodeIndex) => {
    const key = makeR2Key(item, episode.path || episode.sourcePath || episode.video, episodeIndex);
    return {
      ...stripLocalEpisode(episode),
      externalUrl: toR2Path(key),
      r2Key: key,
      video: toR2Path(key),
    };
  });

  return {
    ...stripLocalItem(item),
    description:
      item.description ||
      `已整理为 Cloudflare R2 播放清单的动画资源，共 ${cloudEpisodes.length || item.episodes || 1} 集。`,
    episodeSources: cloudEpisodes,
    episodes: cloudEpisodes.length || item.episodes || 1,
    externalUrl: cloudEpisodes[0]?.externalUrl || "",
    playableMode: "cloudflare-r2",
    r2Prefix: `anime/${slugify(item.id || item.title)}`,
    sourceKind: "cloud-r2",
    sourceRoot: "cloudflare-r2",
    video: cloudEpisodes[0]?.video || "",
  };
}

function stripLocalItem(item) {
  const {
    doubanPoster,
    doubanTitle,
    doubanUrl,
    playableMode,
    sourcePath,
    sourceRoot,
    ...rest
  } = item;
  return rest;
}

function stripLocalEpisode(episode) {
  const { path, playableMode, sourcePath, ...rest } = episode;
  return rest;
}

function makeR2Key(item, filePath, index) {
  const safeTitle = slugify(item.title || item.id || "anime");
  const ext = extname(filePath || "") || ".mp4";
  const filename = `${String(index + 1).padStart(3, "0")}-${slugify(basename(filePath || `episode${ext}`, ext)) || hash(filePath).slice(0, 8)}${ext}`;
  return `anime/${safeTitle}-${hash(item.id || item.title || safeTitle).slice(0, 8)}/${filename}`;
}

function toR2Path(key) {
  return `/media-r2/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function hash(value) {
  return createHash("sha1").update(String(value || "")).digest("hex");
}
