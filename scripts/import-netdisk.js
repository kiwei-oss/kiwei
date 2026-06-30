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
import { basename, extname, join, parse, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const mediaRoot = join(process.cwd(), "public", "media");
const manifestPath = join(mediaRoot, "manifest.json");
const mountedRoot = join(mediaRoot, "mounted");
const coversRoot = join(mediaRoot, "covers");
const playableRoot = join(mediaRoot, "playable");
const doubanCacheRoot = join(mediaRoot, ".cache", "douban");
const videoExts = new Set([".mp4", ".webm", ".m4v", ".mov", ".mkv", ".avi", ".flv", ".ts", ".m2ts"]);
const browserNativeExts = new Set([".mp4", ".webm", ".m4v", ".mov"]);
const imageExts = [".jpg", ".jpeg", ".png", ".webp"];
const args = process.argv.slice(2);

const options = parseArgs(args);
const configPath = join(mediaRoot, "netdisk.json");
const fileConfig = readJson(configPath, {});
for (const key of ["source", "copy", "douban", "limit"]) {
  if (options[key] === undefined && fileConfig[key] !== undefined) options[key] = fileConfig[key];
}
options.copy = Boolean(options.copy);
options.douban = options.douban !== false;
options.limit = Number(options.limit || 500);
const sourceRoot = resolve(options.source || process.env.NETDISK_PATH || "");

if (!options.source && !process.env.NETDISK_PATH) {
  console.error("Usage: npm run import:netdisk -- --source \"/path/to/netdisk/folder\"");
  console.error("Optional: --copy, --no-douban, --limit 200");
  process.exit(1);
}

if (!existsSync(sourceRoot)) {
  console.error(`Netdisk folder not found: ${sourceRoot}`);
  process.exit(1);
}

mkdirSync(mountedRoot, { recursive: true });
mkdirSync(coversRoot, { recursive: true });
mkdirSync(playableRoot, { recursive: true });
mkdirSync(doubanCacheRoot, { recursive: true });

const videoFiles = walk(sourceRoot)
  .filter((file) => videoExts.has(extname(file).toLowerCase()))
  .slice(0, options.limit);

const previousManifest = readJson(manifestPath, { version: 1, items: [] });
const importedItems = [];

for (const [index, file] of videoFiles.entries()) {
  const base = parse(file).name;
  const cleanTitle = cleanMediaTitle(base);
  const id = `${slugify(cleanTitle || base) || "netdisk-video"}-${hash(file).slice(0, 8)}`;
  const videoInfo = materializePlayableVideo(file, id, options.copy);
  const douban = options.douban ? await lookupDouban(cleanTitle || base) : null;
  const cover =
    findSiblingPoster(file) ||
    (douban?.poster ? await downloadDoubanPoster(douban.poster, id) : "") ||
    extractCover(file, id);

  importedItems.push({
    id,
    title: douban?.title || cleanTitle || base,
    subtitle: douban?.rating ? `豆瓣 ${douban.rating}` : "网盘导入",
    category: "网盘导入",
    status: index < 8 ? "hot" : "archive",
    year: douban?.year || "",
    rating: douban?.rating ? "豆瓣" : "16+",
    duration: "网盘资源",
    image: cover || "/assets/hero-poster.png",
    video: toPublicPath(videoInfo.path),
    externalUrl: douban?.url || "",
    match: douban?.rating ? Math.min(99, Math.max(70, Math.round(Number(douban.rating) * 10))) : 88,
    label: douban ? "豆瓣识别" : "网盘",
    progress: 0,
    description:
      douban?.description ||
      `从网盘挂载目录导入的动画资源。原始文件：${basename(file)}`,
    tags: ["网盘导入", ...(douban?.genres || []), ...(douban ? ["豆瓣"] : [])],
    sourceKind: "netdisk",
    sourcePath: file,
    sourceRoot,
    playableMode: videoInfo.mode,
    doubanUrl: douban?.url || "",
    doubanPoster: douban?.poster || "",
    doubanTitle: douban?.title || "",
  });
}

const nextItemsById = new Map(
  (previousManifest.items || [])
    .filter((item) => !(item.sourceKind === "netdisk" && item.sourceRoot === sourceRoot))
    .map((item) => [item.id, item])
);

for (const item of importedItems) {
  nextItemsById.set(item.id, item);
}

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      sourceRoots:
        importedItems.length > 0
          ? [
              ...new Set([
                ...((previousManifest.sourceRoots || []).filter((root) => root !== sourceRoot)),
                sourceRoot,
              ]),
            ]
          : previousManifest.sourceRoots || [],
      items: [...nextItemsById.values()],
    },
    null,
    2
  )}\n`
);

console.log(`Scanned ${videoFiles.length} video file(s) from ${sourceRoot}`);
console.log(`Imported ${importedItems.length} netdisk item(s) into ${manifestPath}`);
console.log(`Mode: ${options.copy ? "copy" : "symlink"}; Douban: ${options.douban ? "enabled" : "disabled"}`);

function parseArgs(values) {
  const parsed = {
    copy: undefined,
    douban: undefined,
    limit: undefined,
    source: undefined,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--copy") parsed.copy = true;
    else if (value === "--no-douban") parsed.douban = false;
    else if (value === "--limit") parsed.limit = Number(values[++index] || 500);
    else if (value === "--source") parsed.source = values[++index] || "";
    else if (!value.startsWith("--") && !parsed.source) parsed.source = value;
  }

  return parsed;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  mkdirSync(resolve(filePath, ".."), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toPublicPath(filePath) {
  return `/${relative(join(process.cwd(), "public"), filePath)
    .split(sep)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex");
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanMediaTitle(value) {
  return value
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/【[^】]+】/g, " ")
    .replace(/\([^)]*(1080|720|2160|4k|bdrip|webrip|x264|x265|hevc|aac|flac|简|繁|字幕)[^)]*\)/gi, " ")
    .replace(/\b(S\d{1,2}E\d{1,3}|EP?\d{1,3}|第\s*\d+\s*[话集]|[0-9]{3,4}p|x26[45]|hevc|bdrip|webrip|web-dl|aac|flac)\b/gi, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findSiblingPoster(videoPath) {
  const { dir, name } = parse(videoPath);
  for (const ext of imageExts) {
    const candidate = join(dir, `${name}${ext}`);
    if (existsSync(candidate)) {
      const target = join(coversRoot, `${slugify(name) || hash(candidate).slice(0, 8)}${ext}`);
      if (!existsSync(target)) copyFileSync(candidate, target);
      return toPublicPath(target);
    }
  }
  return "";
}

function materializeVideo(file, id, copy) {
  const ext = extname(file).toLowerCase();
  const target = join(mountedRoot, `${id}${ext}`);

  if (existsSync(target)) return target;

  if (copy) {
    copyFileSync(file, target);
    return target;
  }

  try {
    symlinkSync(file, target);
  } catch {
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) unlinkSync(target);
    copyFileSync(file, target);
  }

  return target;
}

function materializePlayableVideo(file, id, copy) {
  const ext = extname(file).toLowerCase();

  if (browserNativeExts.has(ext)) {
    return {
      mode: copy ? "copied" : "linked",
      path: materializeVideo(file, id, copy),
    };
  }

  const remuxed = remuxToMp4(file, id);
  if (remuxed) {
    return {
      mode: "remuxed-mp4",
      path: remuxed,
    };
  }

  return {
    mode: copy ? "copied-original" : "linked-original",
    path: materializeVideo(file, id, copy),
  };
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

function extractCover(file, id) {
  const target = join(coversRoot, `${id}.jpg`);
  if (existsSync(target)) return toPublicPath(target);

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

async function lookupDouban(query) {
  const cacheKey = slugify(query) || hash(query).slice(0, 8);
  const cachePath = join(doubanCacheRoot, `${cacheKey}.json`);
  const cached = readJson(cachePath, null);
  if (cached) return cached.found ? cached.data : null;

  try {
    const searchUrl = `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(query)}`;
    const searchHtml = await fetchText(searchUrl);
    const subjectUrl = findDoubanSubjectUrl(searchHtml);

    if (!subjectUrl) {
      writeJson(cachePath, { found: false, query, searchedAt: new Date().toISOString() });
      return null;
    }

    await delay(650);
    const subjectHtml = await fetchText(subjectUrl);
    const data = parseDoubanSubject(subjectHtml, subjectUrl);
    writeJson(cachePath, {
      found: Boolean(data.title),
      query,
      searchedAt: new Date().toISOString(),
      data,
    });
    await delay(650);
    return data.title ? data : null;
  } catch (error) {
    writeJson(cachePath, {
      error: error.message,
      found: false,
      query,
      searchedAt: new Date().toISOString(),
    });
    return null;
  }
}

async function downloadDoubanPoster(url, id) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) return "";

  const ext = extname(new URL(cleanUrl).pathname).toLowerCase() || ".jpg";
  const target = join(coversRoot, `${id}-douban${imageExts.includes(ext) ? ext : ".jpg"}`);
  if (existsSync(target)) return toPublicPath(target);

  try {
    const response = await fetch(cleanUrl, {
      headers: {
        referer: "https://movie.douban.com/",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!response.ok) return "";
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(target, bytes);
    return toPublicPath(target);
  } catch {
    return "";
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  if (!response.ok) throw new Error(`Douban request failed: ${response.status}`);
  return response.text();
}

function findDoubanSubjectUrl(html) {
  const direct = html.match(/https?:\/\/movie\.douban\.com\/subject\/\d+\//);
  if (direct) return direct[0];

  const encoded = html.match(/url=(https%3A%2F%2Fmovie\.douban\.com%2Fsubject%2F\d+%2F)/);
  return encoded ? decodeURIComponent(encoded[1]) : "";
}

function parseDoubanSubject(html, url) {
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  let jsonLd = {};
  if (jsonLdMatch) {
    try {
      jsonLd = JSON.parse(decodeHtml(jsonLdMatch[1].trim()));
    } catch {
      jsonLd = {};
    }
  }

  const title =
    textMatch(html, /<span[^>]+property=["']v:itemreviewed["'][^>]*>(.*?)<\/span>/i) ||
    stripYear(jsonLd.name || "");
  const year =
    textMatch(html, /<span class=["']year["']>\((\d{4})\)<\/span>/i) ||
    String(jsonLd.datePublished || "").slice(0, 4);
  const rating =
    textMatch(html, /<strong[^>]+class=["']ll rating_num["'][^>]*>(.*?)<\/strong>/i) ||
    jsonLd.aggregateRating?.ratingValue ||
    "";
  const description =
    textMatch(html, /<span[^>]+property=["']v:summary["'][^>]*>([\s\S]*?)<\/span>/i) ||
    jsonLd.description ||
    "";
  const poster =
    textMatch(html, /<img[^>]+rel=["']v:image["'][^>]+src=["']([^"']+)["']/i) ||
    jsonLd.image ||
    "";
  const genres = [...html.matchAll(/<span[^>]+property=["']v:genre["'][^>]*>(.*?)<\/span>/gi)]
    .map((match) => decodeHtml(stripTags(match[1])))
    .filter(Boolean);

  return {
    title: decodeHtml(stripTags(title)).trim(),
    year: decodeHtml(stripTags(String(year))).trim(),
    rating: decodeHtml(stripTags(String(rating))).trim(),
    description: decodeHtml(stripTags(description)).replace(/\s+/g, " ").trim(),
    poster: decodeHtml(String(poster)).trim(),
    genres,
    url,
  };
}

function textMatch(value, pattern) {
  const match = value.match(pattern);
  return match ? match[1] : "";
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ");
}

function stripYear(value) {
  return String(value).replace(/\(\d{4}\)$/, "").trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
