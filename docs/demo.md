# Demo video

The 28-second demo shows a real browser session: run a delivery failure, inspect settlement and delivery, then export the matching JSON trace.

GSAP drives the typography, lifecycle path, camera moves, callouts and export receipt. Frames render deterministically at 60 fps, with an original stereo score and timed sound cues. The simulation shot is sped up to fit the edit. All payments are simulated.

## Recreate

Requires FFmpeg, Python 3, Lato fonts and Chromium for Playwright.

```bash
npm run build
npx playwright install chromium
node scripts/capture-demo.mjs
```

Output: `~/Downloads/settled-demo.mp4` and a PNG poster. Use `--output /path/demo.mp4` or `--replace` when needed. Capture uses a temporary local server and temporary data, leaving your workspace traces untouched.

Add `--inspect` to capture a contact sheet without rendering the full video. Add `--keep-capture` to retain source footage for another edit. Re-render with `node scripts/render-demo.mjs CAPTURE_DIRECTORY OUTPUT.mp4`.

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
