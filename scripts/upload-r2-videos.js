import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const manifestPath = join(process.cwd(), "public", "media", "cloud-manifest.json");
const localManifestPath = join(process.cwd(), "public", "media", "manifest.json");
const options = parseArgs(process.argv.slice(2));
const bucket = options.bucket || process.env.R2_BUCKET || "kiwei-anime-videos";
const manifest = readJson(manifestPath, { items: [] });
const localManifest = readJson(localManifestPath, { items: [] });
const localEpisodesByCloudKey = makeLocalEpisodeMap(manifest.items, localManifest.items);
const rows = [...localEpisodesByCloudKey.entries()].filter(([, filePath]) => existsSync(filePath));
const limitedRows = options.limit > 0 ? rows.slice(0, options.limit) : rows;

if (limitedRows.length === 0) {
  console.log("No local videos found for R2 upload.");
  process.exit(0);
}

for (const [index, [key, filePath]] of limitedRows.entries()) {
  console.log(`[${index + 1}/${limitedRows.length}] ${key}`);
  const result = spawnSync("npx", ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "--file", filePath], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
}

console.log(`Uploaded ${limitedRows.length} object(s) to R2 bucket ${bucket}.`);

function parseArgs(values) {
  const parsed = { bucket: "", limit: 0 };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--bucket") parsed.bucket = values[++index] || "";
    else if (value === "--limit") parsed.limit = Number(values[++index] || 0);
  }
  return parsed;
}

function makeLocalEpisodeMap(cloudItems, localItems) {
  const localById = new Map((Array.isArray(localItems) ? localItems : []).map((item) => [item.id, item]));
  const rows = new Map();

  for (const cloudItem of Array.isArray(cloudItems) ? cloudItems : []) {
    const localItem = localById.get(cloudItem.id);
    if (!localItem) continue;

    const localEpisodes = Array.isArray(localItem.episodeSources) ? localItem.episodeSources : [];
    const cloudEpisodes = Array.isArray(cloudItem.episodeSources) ? cloudItem.episodeSources : [];

    for (const cloudEpisode of cloudEpisodes) {
      const localEpisode = localEpisodes.find((episode) => episode.number === cloudEpisode.number);
      if (!cloudEpisode.r2Key || !localEpisode?.path) continue;
      rows.set(cloudEpisode.r2Key, localEpisode.path);
    }
  }

  return rows;
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}
