import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const mediaRoot = join(process.cwd(), "public", "media");
const manifestPath = join(mediaRoot, "manifest.json");
const defaultRclonePath = "/Applications/OpenList-Desktop.app/Contents/MacOS/rclone";
const defaultConfigPath = join(homedir(), "Library", "Application Support", "OpenList Desktop", "rclone.conf");
const nativeVideoExts = new Set([".mp4", ".webm", ".m4v", ".mov"]);
const args = parseArgs(process.argv.slice(2));

const options = {
  baseUrl: trimSlash(args.baseUrl || process.env.OPENLIST_BASE_URL || "http://127.0.0.1:8787"),
  config: args.config || process.env.OPENLIST_RCLONE_CONFIG || defaultConfigPath,
  limitGroups: Number(args.limitGroups || args.limit || 0),
  rclone: args.rclone || process.env.OPENLIST_RCLONE || defaultRclonePath,
  remote: args.remote || process.env.OPENLIST_REMOTE || "OpenList:",
};

if (!existsSync(options.rclone)) {
  console.error(`rclone not found: ${options.rclone}`);
  process.exit(1);
}

if (!existsSync(options.config)) {
  console.error(`OpenList rclone config not found: ${options.config}`);
  process.exit(1);
}

mkdirSync(mediaRoot, { recursive: true });

const rows = listOpenListFiles(options);
const grouped = groupPlayableFiles(rows);
const limitedGroups = options.limitGroups > 0 ? grouped.slice(0, options.limitGroups) : grouped;
const previousManifest = readJson(manifestPath, { version: 1, items: [] });
const previousItems = Array.isArray(previousManifest.items) ? previousManifest.items : [];
const previousOpenListById = new Map(
  previousItems.filter((item) => item.sourceKind === "openlist").map((item) => [item.id, item])
);
const importedItems = limitedGroups.map(([folder, files], index) =>
  mergePreviousMetadata(makeCatalogItem(folder, files, index, options), previousOpenListById)
);
const nextItemsById = new Map();

for (const item of previousItems) {
  if (item.sourceKind === "openlist" && item.sourceRoot === options.remote) continue;
  nextItemsById.set(item.id, item);
}

for (const item of importedItems) {
  nextItemsById.set(item.id, item);
}

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      sourceRoots: unique([...(previousManifest.sourceRoots || []), options.remote]),
      items: [...nextItemsById.values()],
    },
    null,
    2
  )}\n`
);

console.log(`Listed ${rows.length} browser-playable OpenList file(s).`);
console.log(`Imported ${importedItems.length} grouped OpenList item(s) into ${manifestPath}`);
console.log(`Playback base URL: ${options.baseUrl}`);
console.log("Run `npm run serve:openlist` while watching these resources.");

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--base-url") parsed.baseUrl = values[++index] || "";
    else if (value === "--config") parsed.config = values[++index] || "";
    else if (value === "--limit") parsed.limit = Number(values[++index] || 0);
    else if (value === "--limit-groups") parsed.limitGroups = Number(values[++index] || 0);
    else if (value === "--rclone") parsed.rclone = values[++index] || "";
    else if (value === "--remote") parsed.remote = values[++index] || "";
  }

  return parsed;
}

function listOpenListFiles(options) {
  const result = spawnSync(
    options.rclone,
    [
      "lsf",
      "--config",
      options.config,
      "-R",
      "--files-only",
      "--format",
      "sp",
      "--separator",
      "\t",
      options.remote,
    ],
    { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 }
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => {
      const splitAt = line.indexOf("\t");
      if (splitAt < 0) return null;
      const size = Number(line.slice(0, splitAt));
      const path = line.slice(splitAt + 1).trim();
      const ext = extname(path).toLowerCase();
      if (!nativeVideoExts.has(ext)) return null;
      return {
        ext,
        path,
        size,
      };
    })
    .filter(Boolean);
}

function groupPlayableFiles(rows) {
  const groups = new Map();
  for (const row of rows) {
    const folder = dirname(row.path);
    const files = groups.get(folder) || [];
    files.push(row);
    groups.set(folder, files);
  }

  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

  return [...groups.entries()]
    .map(([folder, files]) => [folder, files.sort((a, b) => collator.compare(a.path, b.path))])
    .sort((a, b) => {
      const countDiff = b[1].length - a[1].length;
      if (countDiff) return countDiff;
      return collator.compare(a[0], b[0]);
    });
}

function makeCatalogItem(folder, files, index, options) {
  const title = cleanTitle(basename(folder) || folder);
  const parent = cleanTitle(basename(dirname(folder)));
  const year = extractYear(`${folder} ${files.map((file) => file.path).join(" ")}`);
  const episodes = files.map((file, fileIndex) => {
    const title = cleanTitle(basename(file.path, extname(file.path))) || `第 ${fileIndex + 1} 集`;
    const video = `${options.baseUrl}/${encodePath(file.path)}`;
    return {
      number: fileIndex + 1,
      title,
      video,
      externalUrl: video,
      path: file.path,
      size: file.size,
    };
  });

  return {
    id: `openlist-${slugify(folder) || "resource"}-${hash(folder).slice(0, 8)}`,
    title,
    subtitle: parent && parent !== "." ? `OpenList · ${parent}` : "OpenList · 夸克网盘",
    category: "网盘导入",
    status: index < 18 ? "hot" : "archive",
    year,
    rating: "16+",
    duration: `${episodes.length} 集`,
    image: "/assets/hero-poster.png",
    video: episodes[0]?.video || "",
    externalUrl: `${options.baseUrl}/${encodePath(folder)}/`,
    match: Math.max(72, 96 - Math.floor(index / 3)),
    label: "OpenList",
    progress: 0,
    description: `从 OpenList / 夸克挂载导入的分组资源，共 ${episodes.length} 个可播放文件。播放时需要保持 OpenList 和本地 rclone HTTP 服务运行。`,
    tags: unique(["OpenList", "夸克网盘", "网盘导入", parent]),
    sourceKind: "openlist",
    sourcePath: folder,
    sourceRoot: options.remote,
    playableMode: "rclone-http",
    episodes: episodes.length,
    episodeSources: episodes,
  };
}

function mergePreviousMetadata(item, previousOpenListById) {
  const previous = previousOpenListById.get(item.id);
  if (!previous) return item;

  return {
    ...item,
    description:
      previous.moegirlUrl && previous.description && !isGenericOpenListDescription(previous.description)
        ? previous.description
        : item.description,
    image: previous.moegirlImage || previous.image || item.image,
    moegirlImage: previous.moegirlImage || "",
    moegirlTitle: previous.moegirlTitle || "",
    moegirlUrl: previous.moegirlUrl || "",
    tags: unique([...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(previous.tags) ? previous.tags : [])]),
  };
}

function isGenericOpenListDescription(value) {
  return String(value || "").includes("从 OpenList / 夸克挂载导入");
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/【[^】]+】/g, " ")
    .replace(/\b(1080p|2160p|720p|bdrip|webrip|web-dl|x26[45]|h\.?26[45]|hevc|aac|opus|bluray)\b/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYear(value) {
  const match = String(value || "").match(/\b(20\d{2})\b/);
  const year = match ? Number(match[1]) : 2026;
  return year >= 2000 && year <= 2026 ? String(year) : "2026";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex");
}

function encodePath(value) {
  return String(value || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
