import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const assetDir = join(process.cwd(), "public", "assets");
const input = join(assetDir, "hero-poster.png");
const output = join(assetDir, "hero-loop.mp4");

if (!existsSync(input)) {
  throw new Error("Run npm run generate:assets before generating the hero video.");
}

const filter = [
  "scale=1920:1080",
  "zoompan=z='min(zoom+0.00055,1.055)':x='iw/2-(iw/zoom/2)+sin(on/21)*16':y='ih/2-(ih/zoom/2)+cos(on/24)*10':d=1:s=1920x1080:fps=30",
  "eq=contrast=1.08:saturation=1.12:brightness=-0.025",
  "drawgrid=w=96:h=96:t=1:c=0x56f0ff@0.10",
  "drawbox=x='mod(t*250\\,iw)-iw*0.34':y=ih*0.32:w=iw*0.62:h=2:color=0x56f0ff@0.38:t=fill",
  "drawbox=x='iw-mod(t*180\\,iw*1.2)':y=ih*0.66:w=iw*0.54:h=2:color=0xff4f9f@0.30:t=fill",
  "format=yuv420p",
].join(",");

const result = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-loop",
    "1",
    "-i",
    input,
    "-t",
    "8",
    "-vf",
    filter,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  throw new Error("Failed to generate hero-loop.mp4.");
}

console.log(`Generated ${output}`);
