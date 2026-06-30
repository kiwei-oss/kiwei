import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, parse, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const defaultSource = "/Users/kiwei/Downloads/OpenList/动漫";
const mediaRoot = join(process.cwd(), "public", "media");
const manifestPath = join(mediaRoot, "manifest.json");
const mountedRoot = join(mediaRoot, "mounted", "openlist-local");
const playableRoot = join(mediaRoot, "playable", "openlist-local");
const coversRoot = join(mediaRoot, "covers", "openlist-local");
const videoExts = new Set([".mp4", ".webm", ".m4v", ".mov", ".mkv", ".avi", ".flv", ".ts", ".m2ts"]);
const browserNativeExts = new Set([".mp4", ".webm", ".m4v", ".mov"]);
const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const importedKinds = new Set(["local-openlist", "openlist", "netdisk", "public-share"]);
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const options = parseArgs(process.argv.slice(2));
const sourceRoot = resolve(options.source || process.env.OPENLIST_LOCAL_PATH || defaultSource);
const failedRemuxes = [];

if (!existsSync(sourceRoot)) {
  console.error(`OpenList folder not found: ${sourceRoot}`);
  process.exit(1);
}

mkdirSync(mountedRoot, { recursive: true });
mkdirSync(playableRoot, { recursive: true });
mkdirSync(coversRoot, { recursive: true });

const files = walk(sourceRoot)
  .filter((file) => videoExts.has(extname(file).toLowerCase()))
  .filter((file) => !isIgnoredPath(file));
const groups = groupByFolder(files);
const limitedGroups = options.limitGroups > 0 ? groups.slice(0, options.limitGroups) : groups;
const previousManifest = readJson(manifestPath, { version: 1, items: [] });
const previousItems = Array.isArray(previousManifest.items) ? previousManifest.items : [];
const previousById = new Map(previousItems.filter((item) => importedKinds.has(item.sourceKind)).map((item) => [item.id, item]));
const importedItems = [];

for (const [index, [folder, groupFiles]] of limitedGroups.entries()) {
  if (index % 20 === 0) {
    console.log(`Importing group ${index + 1}/${limitedGroups.length}: ${relative(sourceRoot, folder) || basename(folder)}`);
  }
  const item = makeCatalogItem(folder, groupFiles, index);
  importedItems.push(mergePreviousMetadata(item, previousById.get(item.id)));
}

const nextItems = [
  ...previousItems.filter((item) => !importedKinds.has(item.sourceKind)),
  ...importedItems,
];

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      sourceRoots: unique([...(previousManifest.sourceRoots || []).filter((root) => root !== sourceRoot), sourceRoot]),
      items: nextItems,
    },
    null,
    2
  )}\n`
);

console.log(`Scanned ${files.length} anime video file(s) from ${sourceRoot}`);
console.log(`Imported ${importedItems.length} grouped anime item(s) into ${manifestPath}`);
console.log(
  `Mode: ${options.linkNative ? (options.copy ? "copy-native" : "link-native") : "runtime-stream"}; Remux: ${
    options.remux ? "enabled" : "disabled"
  }; Runtime stream: enabled`
);
if (failedRemuxes.length > 0) {
  console.log(`Remux fallback count: ${failedRemuxes.length}. These files were linked as original format.`);
}

function parseArgs(values) {
  const parsed = {
    copy: false,
    extractCovers: false,
    linkNative: false,
    limitGroups: 0,
    remux: false,
    source: "",
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--copy") parsed.copy = true;
    else if (value === "--extract-covers") parsed.extractCovers = true;
    else if (value === "--link-native") parsed.linkNative = true;
    else if (value === "--remux") parsed.remux = true;
    else if (value === "--no-remux") parsed.remux = false;
    else if (value === "--limit-groups") parsed.limitGroups = Number(values[++index] || 0);
    else if (value === "--source") parsed.source = values[++index] || "";
    else if (!value.startsWith("--") && !parsed.source) parsed.source = value;
  }

  return parsed;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) return [];
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function groupByFolder(videoFiles) {
  const groups = new Map();
  for (const file of videoFiles) {
    const folder = dirname(file);
    const entries = groups.get(folder) || [];
    entries.push(file);
    groups.set(folder, entries);
  }

  return [...groups.entries()]
    .map(([folder, entries]) => [folder, entries.sort((a, b) => collator.compare(basename(a), basename(b)))])
    .sort((a, b) => {
      const topA = topFolderName(a[0]);
      const topB = topFolderName(b[0]);
      const topDiff = collator.compare(topA, topB);
      if (topDiff) return topDiff;
      return collator.compare(relative(sourceRoot, a[0]), relative(sourceRoot, b[0]));
    });
}

function makeCatalogItem(folder, groupFiles, index) {
  const relativeFolder = relative(sourceRoot, folder);
  const title = makeTitle(folder);
  const parent = cleanTitle(basename(dirname(folder)));
  const text = `${relativeFolder} ${groupFiles.map((file) => basename(file)).join(" ")}`;
  const year = extractYear(text, index);
  const season = inferSeason(text, index);
  const type = inferType(text, index);
  const id = `openlist-local-${slugify(relativeFolder || title) || "anime"}-${hash(relativeFolder || folder).slice(0, 8)}`;
  const episodes = groupFiles.map((file, fileIndex) => {
    const episodeId = `${id}-ep-${String(fileIndex + 1).padStart(3, "0")}-${hash(file).slice(0, 6)}`;
    const playable = materializePlayableVideo(file, episodeId);
    const videoUrl = playable.url || toPublicPath(playable.path);
    const episodeTitle = cleanEpisodeTitle(basename(file, extname(file))) || `第${String(fileIndex + 1).padStart(2, "0")}集`;

    return {
      number: fileIndex + 1,
      title: episodeTitle,
      video: videoUrl,
      externalUrl: videoUrl,
      path: file,
      playableMode: playable.mode,
    };
  });
  const cover = findPoster(folder, id) || (options.extractCovers ? extractCover(groupFiles[0], id) : "");

  return {
    id,
    title,
    subtitle: parent && parent !== title ? `OpenList · ${parent}` : "OpenList · 夸克网盘",
    category: "视频分类",
    type,
    season,
    status: index < 24 ? "hot" : "archive",
    year,
    rating: "16+",
    duration: `${episodes.length} 集`,
    image: cover || "/assets/hero-poster.png",
    video: episodes[0]?.video || "",
    externalUrl: episodes[0]?.externalUrl || "",
    match: Math.max(72, 98 - Math.floor(index / 4)),
    label: "OpenList",
    progress: 0,
    description: `从夸克网盘本地挂载目录导入的动画资源，已按文件夹整理为 ${episodes.length} 集。原始目录：${relativeFolder || basename(folder)}`,
    tags: unique(["OpenList", "夸克网盘", "本地挂载", type, season, year, parent]),
    sourceKind: "local-openlist",
    sourcePath: folder,
    sourceRoot,
    playableMode: "local-linked",
    episodes: episodes.length,
    episodeSources: episodes,
  };
}

function makeTitle(folder) {
  const leaf = cleanTitle(basename(folder));
  const parent = cleanTitle(basename(dirname(folder)));
  if (parent && isGenericSeasonName(leaf) && dirname(folder) !== sourceRoot) {
    return `${parent} ${leaf}`.trim();
  }
  return leaf || parent || cleanTitle(basename(folder));
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/^\d+(?:\(\d+\))?[.\s-]*/g, "")
    .replace(/^[A-Z]{1,4}\s*[丨|]\s*/gi, "")
    .replace(/^[A-Z]\s+(?=[\u4e00-\u9fa5])/i, "")
    .replace(/[丨|]/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/【[^】]+】/g, " ")
    .replace(/\([^)]*(1080|720|2160|4K|BD|WEB|x26[45]|HEVC|AAC|字幕|简|繁)[^)]*\)/gi, " ")
    .replace(/\b(1080p|2160p|720p|4k|bdrip|webrip|web-dl|x26[45]|h\.?26[45]|hevc|aac|opus|bluray)\b/gi, " ")
    .replace(/\b(全|内嵌|内封|外挂|中字|日语|英语|简中|繁中|硬字幕|软字幕)\b/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEpisodeTitle(value) {
  const cleaned = cleanTitle(value)
    .replace(/\b(S\d{1,2}E\d{1,3}|EP?\s*\d{1,3})\b/gi, "")
    .replace(/^第?\s*\d{1,3}\s*[话集]?$/u, "")
    .replace(/^\d{1,3}$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function isGenericSeasonName(value) {
  return /^(S\d{1,2}|第[一二三四五六七八九十零0-9]+季|第[一二三四五六七八九十零0-9]+部|Part\s*\d+|OAD|OVA|剧场版|真人版|外传|\d+\s*第一季|\d+\s*第二季|\d+\s*第三季|\d+\s*第四季|\d+\s*第五季|\d+\s*第六季)/i.test(
    value
  );
}

function extractYear(value, index) {
  const years = [...String(value || "").matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 2000 && year <= 2026);
  if (years.length > 0) return String(years[0]);
  return String(2026 - (index % 27));
}

function inferSeason(value, index) {
  const text = String(value || "");
  if (/(1月|01月|一月|冬)/.test(text)) return "一月新番";
  if (/(4月|04月|四月|春)/.test(text)) return "4 月新番";
  if (/(7月|07月|七月|夏)/.test(text)) return "7 月新番";
  if (/(10月|十月|秋)/.test(text)) return "10 月新番";
  return ["一月新番", "4 月新番", "7 月新番", "10 月新番"][index % 4];
}

function inferType(value, index) {
  const text = String(value || "").toLowerCase();
  const typeRules = [
    ["运动竞技", ["排球", "篮球", "足球", "运动", "竞技", "比赛"]],
    ["偶像音乐", ["偶像", "音乐", "乐队", "演唱", "mygo", "哭泣少女", "孤独摇滚"]],
    ["恋爱言情", ["恋爱", "爱情", "言情", "终将成为你", "四月是你的谎言", "辉夜"]],
    ["科幻机甲", ["科幻", "机甲", "code geass", "鲁路修", "赛博", "机器人", "外星", "无敌少侠", "攻壳", "eva"]],
    ["异世界奇幻", ["异世界", "奇幻", "魔法", "幻想", "勇者", "转生"]],
    ["悬疑推理", ["悬疑", "推理", "侦探", "犯罪", "死亡笔记"]],
    ["惊悚致郁", ["惊悚", "恐怖", "致郁", "学园孤岛", "寒蝉", "来自深渊"]],
    ["搞笑喜剧", ["搞笑", "喜剧", "碧蓝之海", "瑞克", "莫蒂"]],
    ["校园日常", ["校园", "日常", "青春", "社团", "四叠半"]],
    ["治愈温情", ["治愈", "温情", "家庭", "温柔", "夏目"]],
    ["古风历史", ["古风", "历史", "时代", "黄金神威"]],
    ["美食种田", ["美食", "料理", "种田", "田园"]],
    ["热血战斗", ["热血", "战斗", "动作", "冒险", "进击", "巨人", "咒术", "jojo", "一拳", "鬼灭", "血界", "暗杀"]],
  ];
  const hit = typeRules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword.toLowerCase())));
  if (hit) return hit[0];
  return ["热血战斗", "校园日常", "异世界奇幻", "科幻机甲"][index % 4];
}

function findPoster(folder, id) {
  const candidates = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (imageExts.has(ext)) candidates.push(join(folder, entry.name));
  }
  if (candidates.length === 0) return "";

  const source = candidates.sort((a, b) => collator.compare(basename(a), basename(b)))[0];
  const ext = extname(source).toLowerCase();
  const target = join(coversRoot, `${id}${ext}`);
  if (!existsSync(target)) copyFileSync(source, target);
  return toPublicPath(target);
}

function extractCover(file, id) {
  const target = join(coversRoot, `${id}.jpg`);
  if (existsSync(target)) return toPublicPath(target);
  if (!ffmpegPath) return "";

  const result = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-ss",
      "00:00:08",
      "-i",
      file,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      "-vf",
      "scale=960:-1",
      target,
    ],
    { stdio: "ignore" }
  );

  return result.status === 0 && existsSync(target) ? toPublicPath(target) : "";
}

function materializePlayableVideo(file, id) {
  const ext = extname(file).toLowerCase();
  if (options.linkNative && browserNativeExts.has(ext)) {
    return {
      mode: options.copy ? "copied" : "linked",
      path: materializeVideo(file, join(mountedRoot, `${id}${ext}`)),
    };
  }

  if (options.remux && ffmpegPath) {
    const remuxed = remuxToMp4(file, id);
    if (remuxed) {
      return {
        mode: "remuxed-mp4",
        path: remuxed,
      };
    }
    failedRemuxes.push(file);
  }

  return {
    mode: "ffmpeg-stream",
    url: toLocalStreamPath(file),
  };
}

function materializeVideo(file, target) {
  if (existsSync(target)) return target;

  if (options.copy) {
    copyFileSync(file, target);
    return target;
  }

  try {
    symlinkSync(file, target);
  } catch {
    try {
      if (lstatSync(target).isSymbolicLink()) unlinkSync(target);
    } catch {
      // Target did not exist.
    }
    copyFileSync(file, target);
  }

  return target;
}

function remuxToMp4(file, id) {
  const target = join(playableRoot, `${id}.mp4`);
  if (existsSync(target)) return target;

  const result = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      target,
    ],
    { stdio: "ignore" }
  );

  return result.status === 0 && existsSync(target) ? target : "";
}

function isIgnoredPath(file) {
  const path = relative(sourceRoot, file);
  return /(^|\/)(000-|更多持续|夸克资源分享|没字幕的视频|字幕|subs?|fonts?)(\/|$)/i.test(path);
}

function topFolderName(folder) {
  return relative(sourceRoot, folder).split(sep)[0] || basename(folder);
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function toPublicPath(filePath) {
  return `/${relative(join(process.cwd(), "public"), filePath)
    .split(sep)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function toLocalStreamPath(filePath) {
  return `/__local_video?path=${encodeURIComponent(filePath)}`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function mergePreviousMetadata(item, previous) {
  if (!previous) return item;
  return {
    ...item,
    description:
      previous.description && !String(previous.description).includes("从夸克网盘本地挂载目录导入")
        ? previous.description
        : item.description,
    image: previous.moegirlImage || previous.image || item.image,
    moegirlImage: previous.moegirlImage || "",
    moegirlTitle: previous.moegirlTitle || "",
    moegirlUrl: previous.moegirlUrl || "",
    progress: Number(previous.progress || item.progress || 0),
    tags: unique([...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(previous.tags) ? previous.tags : [])]),
  };
}
