# kiwei
# -kiwei
# -kiwei
# kiwei

## Cloudflare Pages

Build command:

```bash
npm run build
```

Build output directory:

```bash
dist
```

Node.js version:

```bash
24
```

The deployed Cloudflare site is a static React/Vite site. Local OpenList playback depends on the local Vite server and files under `/Users/kiwei/Downloads/OpenList`, so those private media files are not uploaded to GitHub or Cloudflare.

## Online Video Playback

Cloudflare Pages cannot read local files from `/Users/kiwei/Downloads/OpenList`. Online playback uses Cloudflare R2:

1. Enable R2 in the Cloudflare dashboard.
2. Create the bucket:

```bash
npx wrangler r2 bucket create kiwei-anime-videos
```

3. Generate a cloud manifest from the local OpenList manifest:

```bash
npm run build:cloud-manifest
```

4. Upload videos to R2. Start with a small test:

```bash
npm run upload:r2 -- --limit 1
```

Upload all videos after confirming playback:

```bash
npm run upload:r2
```

5. Build and deploy the R2-enabled cloud version:

```bash
npm run build:cloud
npx wrangler pages deploy dist --project-name kiwei --config wrangler.r2.toml
```

The Pages Function at `/media-r2/*` reads video files from the private R2 bucket and supports browser range requests.
