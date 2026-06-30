const videoTypes = {
  ".avi": "video/x-msvideo",
  ".flv": "video/x-flv",
  ".m2ts": "video/mp2t",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".ts": "video/mp2t",
  ".webm": "video/webm",
};

export async function onRequest(context) {
  const bucket = context.env.ANIME_VIDEOS;
  if (!bucket) return new Response("R2 binding ANIME_VIDEOS is not configured", { status: 500 });

  const key = getKey(context);
  if (!key) return new Response("Missing video key", { status: 400 });

  const head = await bucket.head(key);
  if (!head) return new Response("Video not found", { status: 404 });

  const headers = new Headers();
  head.writeHttpMetadata(headers);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600");
  if (!headers.has("content-type")) headers.set("content-type", inferContentType(key));

  if (context.request.method === "HEAD") {
    headers.set("content-length", String(head.size));
    return new Response(null, { headers });
  }

  const range = parseRange(context.request.headers.get("range"), head.size);
  if (range.invalid) {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "content-range": `bytes */${head.size}` },
    });
  }

  const object = await bucket.get(key, range.value ? { range: range.value } : undefined);
  if (!object) return new Response("Video not found", { status: 404 });

  if (range.value) {
    headers.set("content-length", String(range.value.length));
    headers.set("content-range", `bytes ${range.start}-${range.end}/${head.size}`);
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(head.size));
  return new Response(object.body, { headers });
}

function getKey(context) {
  const value = context.params.path;
  const parts = Array.isArray(value) ? value : [value || ""];
  return parts.map((part) => decodeURIComponent(part)).filter(Boolean).join("/");
}

function parseRange(value, size) {
  if (!value) return { value: null };
  const match = value.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return { invalid: true };

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return { invalid: true };
  }

  end = Math.min(end, size - 1);
  return {
    end,
    start,
    value: {
      length: end - start + 1,
      offset: start,
    },
  };
}

function inferContentType(key) {
  const ext = `.${String(key || "").split(".").pop().toLowerCase()}`;
  return videoTypes[ext] || "application/octet-stream";
}
