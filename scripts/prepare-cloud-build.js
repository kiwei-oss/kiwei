import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const mediaRoot = join(process.cwd(), "public", "media");
const manifestPath = join(mediaRoot, "manifest.json");
const localManifestPath = join(mediaRoot, "manifest.local.json");
const cloudManifestPath = join(mediaRoot, "cloud-manifest.json");

const buildManifestResult = spawnSync("node", ["scripts/build-cloud-manifest.js"], {
  encoding: "utf8",
  stdio: "inherit",
});

if (buildManifestResult.status !== 0) {
  process.exit(buildManifestResult.status || 1);
}

if (existsSync(manifestPath)) {
  copyFileSync(manifestPath, localManifestPath);
}

if (existsSync(cloudManifestPath)) {
  copyFileSync(cloudManifestPath, manifestPath);
}

const buildResult = spawnSync("npm", ["run", "build"], {
  encoding: "utf8",
  stdio: "inherit",
});

if (existsSync(localManifestPath)) {
  copyFileSync(localManifestPath, manifestPath);
}

process.exit(buildResult.status || 0);
