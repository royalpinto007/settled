# Demo video

The 27-second demo shows a real browser session: select a delivery failure, run the simulation, inspect settlement and delivery, then export the matching JSON trace.

The edit uses close-ups, captions, short crossfades and an original synth soundtrack. All payments are labeled as simulations. No funds move.

## Recreate

Requires FFmpeg, Python 3, Lato fonts and Chromium for Playwright.

```bash
npm run build
npx playwright install chromium
node scripts/capture-demo.mjs
```

Output: `~/Downloads/settled-demo.mp4` and a PNG poster. Use `--output /path/demo.mp4` or `--replace` when needed. Capture uses a temporary local server and temporary data, leaving your workspace traces untouched.

| Time    | Scene                               |
| ------- | ----------------------------------- |
| 0–3 s   | Payment settled, delivery failed    |
| 3–8 s   | Choose and run the failure scenario |
| 8–13 s  | Inspect the exact failed stage      |
| 13–17 s | Check transaction evidence          |
| 17–22 s | Export JSON                         |
| 22–27 s | Project and repository link         |

Export: H.264, 1920 × 1080, 30 fps, AAC stereo, fast-start MP4. Review the video before posting. Publication is not automated.

[Social preview](social-preview.png): a 1200 × 630 frame for GitHub's repository social-preview setting. Upload it from repository Settings after review.
