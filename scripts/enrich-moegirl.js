import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const mediaRoot = join(process.cwd(), "public", "media");
const manifestPath = join(mediaRoot, "manifest.json");
const cacheRoot = join(mediaRoot, ".cache", "moegirl");
const args = parseArgs(process.argv.slice(2));
const limit = Number(args.limit || 40);
const delayMs = Number(args.delay || 800);
const only = String(args.only || "").trim();

mkdirSync(cacheRoot, { recursive: true });

const manifest = readJson(manifestPath, { version: 1, items: [] });
const items = Array.isArray(manifest.items) ? manifest.items : [];
let enrichedCount = 0;

for (const item of items) {
  if (limit > 0 && enrichedCount >= limit) break;
  if (item.moegirlUrl || item.sourceKind !== "openlist") continue;
  if (only && !`${item.title} ${item.sourcePath || ""}`.includes(only)) continue;

  const query = normalizeMoegirlTitle(item.title, item.sourcePath);
  if (!query || query.length < 2) continue;

  const metadata = await fetchMoegirlMetadata(query);
  if (!metadata?.url) continue;

  item.moegirlTitle = metadata.title || query;
  item.moegirlUrl = metadata.url;
  item.moegirlImage = metadata.image || "";
  item.image = metadata.image || item.image;
  item.description =
    metadata.description && isGenericOpenListDescription(item.description)
      ? `${metadata.description} 来源：萌娘百科。`
      : item.description;
  item.tags = unique([...(Array.isArray(item.tags) ? item.tags : []), "萌娘百科"]);
  enrichedCount += 1;
  await delay(delayMs);
}

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      ...manifest,
      updatedAt: new Date().toISOString(),
      items,
    },
    null,
    2
  )}\n`
);

console.log(`Enriched ${enrichedCount} item(s) with Moegirl metadata.`);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--delay") parsed.delay = Number(values[++index] || 800);
    else if (value === "--limit") parsed.limit = Number(values[++index] || 40);
    else if (value === "--only") parsed.only = values[++index] || "";
  }
  return parsed;
}

async function fetchMoegirlMetadata(title) {
  const cachePath = join(cacheRoot, `${slugify(title) || hash(title).slice(0, 8)}.json`);
  const cached = readJson(cachePath, null);
  if (cached) return cached.found ? cached.data : null;

  const url = `https://zh.moegirl.org.cn/${encodeURIComponent(title)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "user-agent": "NEON-FRAME/0.1 local personal anime site metadata importer",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      writeJson(cachePath, { found: false, title, status: response.status });
      return null;
    }

    const html = await response.text();
    if (isMissingPage(html)) {
      writeJson(cachePath, { found: false, title, reason: "missing-page" });
      return null;
    }

    const data = {
      description: cleanDescription(
        findMeta(html, "property", "og:description") || findMeta(html, "name", "description")
      ),
      image: absolutizeUrl(findMeta(html, "property", "og:image"), response.url),
      title: cleanTitle(findMeta(html, "property", "og:title") || findTitle(html)),
      url: response.url,
    };

    writeJson(cachePath, { data, found: Boolean(data.title), title });
    return data.title ? data : null;
  } catch (error) {
    writeJson(cachePath, { error: error.message, found: false, title });
    return null;
  }
}

function normalizeMoegirlTitle(title, sourcePath) {
  const source = `${sourcePath || ""} ${title || ""}`;
  const knownTitles = [
    "进击的巨人",
    "赛博朋克：边缘行者",
    "电锯人",
    "灵能百分百",
    "孤独摇滚",
    "异兽魔都",
    "四叠半神话大系",
    "夏日重现",
    "天元突破红莲螺岩",
    "碧蓝之海",
    "齐木楠雄的灾难",
    "新世纪福音战士",
    "星际牛仔",
    "银魂",
    "JOJO的奇妙冒险",
  ];
  const hit = knownTitles.find((candidate) => normalizeLoose(source).includes(normalizeLoose(candidate)));
  if (hit) return hit;
  return String(title || "")
    .replace(/\b(S\d+|Season\s*\d+|part\s*\d+|第?\d+\s*[季部]?|全\d+集).*$/i, "")
    .replace(/[._-]+/g, " ")
    .trim();
}

function normalizeLoose(value) {
  return String(value || "").replace(/[\s:：.·\-_/]+/g, "").toLowerCase();
}

function isGenericOpenListDescription(value) {
  return String(value || "").includes("从 OpenList / 夸克挂载导入");
}

function isMissingPage(html) {
  return /该页面不存在|您可以创建本页面|action=edit/.test(html) && !/<meta property="og:image"/.test(html);
}

function findMeta(html, attrName, attrValue) {
  const escaped = escapeRegExp(attrValue);
  const metaRegex = new RegExp(`<meta\\b(?=[^>]*\\b${attrName}=["']${escaped}["'])[^>]*>`, "i");
  const match = html.match(metaRegex);
  if (!match) return "";
  return getAttribute(match[0], "content");
}

function findTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1] : "";
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
}

function cleanDescription(value) {
  return decodeHtmlEntities(stripTags(value)).replace(/\s+/g, " ").replace(/\.\.\.$/, "").trim();
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, ""));
}

function cleanTitle(value) {
  return stripTags(value).replace(/ - 萌娘百科.*$/, "").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function absolutizeUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
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
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
