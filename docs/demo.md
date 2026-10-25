# Demo video

The 28-second demo runs the actual dashboard: simulate a delivery failure, inspect settlement and delivery, then export the matching JSON trace.

GSAP drives the typography, camera and callouts around one live app window. UI text renders directly from the DOM at 60 fps. The movie uses a compact inspector layout, an original stereo score and timed sound cues. All payments are simulated.

## Recreate

Requires FFmpeg, Python 3, Lato fonts and Chromium for Playwright.

```bash
npm run build
npx playwright install chromium
node scripts/capture-demo.mjs
```

Output: `~/Downloads/settled-demo.mp4` and a PNG poster. Use `--output /path/demo.mp4` or `--replace` when needed. Rendering uses a temporary local server and JSON store, leaving your workspace traces untouched.

Add `--inspect` for a contact sheet or `--keep-capture` to retain the rendered frames and export evidence. Re-render with `node scripts/render-demo.mjs WORK_DIRECTORY OUTPUT.mp4`.

`npm run demo:check` verifies the live interactions, panel framing, camera scrubbing and downloaded JSON. It also checks that a shifted panel is rejected. This check runs in CI and needs Chromium, without FFmpeg or Python.

| Time    | Scene                               |
| ------- | ----------------------------------- |
| 0–3 s   | Payment settled, delivery failed    |
| 3–8 s   | Choose and run the failure scenario |
| 8–14 s  | Inspect the exact failed stage      |
| 14–18 s | Check transaction evidence          |
| 18–23 s | Export JSON                         |
| 23–28 s | Project and repository link         |

Export: H.264, 1920 × 1080, 60 fps, AAC stereo, fast-start MP4. Review before posting. Publication is not automated.

[Social preview](social-preview.png): a 1200 × 630 frame for GitHub's repository social-preview setting. Upload it from repository Settings after review.
