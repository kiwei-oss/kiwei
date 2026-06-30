import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, resolve } from "node:path";
import ffmpegPath from "ffmpeg-static";

const localVideoRoots = [resolve("/Users/kiwei/Downloads/OpenList")];
const nativeVideoTypes = {
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function localVideoPlugin() {
  return {
    name: "local-openlist-video",
    configureServer(server) {
      server.middlewares.use("/__local_video", handleLocalVideo);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__local_video", handleLocalVideo);
    },
  };
}

function handleLocalVideo(request, response) {
  const url = new URL(request.url || "", "http://local");
  const file = resolve(url.searchParams.get("path") || "");

  if (!isAllowedLocalFile(file) || !existsSync(file)) {
    response.writeHead(404);
    response.end("Video not found");
    return;
  }

  const ext = extname(file).toLowerCase();
  if (nativeVideoTypes[ext]) {
    serveNativeVideo(file, request, response, nativeVideoTypes[ext]);
    return;
  }

  streamWithFfmpeg(file, request, response);
}

function isAllowedLocalFile(file) {
  return localVideoRoots.some((root) => file === root || file.startsWith(`${root}/`));
}

function serveNativeVideo(file, request, response, contentType) {
  const stat = statSync(file);
  const range = request.headers.range;

  if (!range) {
    response.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Length": stat.size,
      "Content-Type": contentType,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
    return;
  }

  const [startText, endText] = range.replace(/bytes=/, "").split("-");
  const start = Number(startText);
  const end = endText ? Number(endText) : stat.size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= stat.size) {
    response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    response.end();
    return;
  }

  response.writeHead(206, {
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Content-Type": contentType,
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(file, { start, end }).pipe(response);
}

function streamWithFfmpeg(file, request, response) {
  if (!ffmpegPath) {
    response.writeHead(500);
    response.end("ffmpeg is not available");
    return;
  }

  response.writeHead(200, {
    "Accept-Ranges": "none",
    "Cache-Control": "no-store",
    "Content-Type": "video/mp4",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const ffmpeg = spawn(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "-f",
      "mp4",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );

  ffmpeg.stdout.pipe(response);
  response.on("close", () => {
    if (!ffmpeg.killed) ffmpeg.kill("SIGKILL");
  });
}

export default defineConfig({
  plugins: [react(), localVideoPlugin()],
});
