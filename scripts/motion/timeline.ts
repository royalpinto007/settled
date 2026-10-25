import { gsap } from "gsap";

type Shot = { name: string; start: number; end: number; offset: number };
const clips: Shot[] = [
  { name: "simulate", start: 4.15, end: 8.0, offset: 1.3 },
  { name: "timeline", start: 8.8, end: 14.1, offset: 0.1 },
  { name: "transaction", start: 14.0, end: 17.8, offset: 0.45 },
  { name: "export", start: 17.8, end: 22.8, offset: 0.1 },
];
const duration = 28;
const tl = gsap.timeline({
  paused: true,
  defaults: { ease: "power3.out", duration: 0.6 },
});
const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const videos = [...document.querySelectorAll<HTMLVideoElement>("video")];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
gsap.ticker.sleep();
gsap.set(".scene", { autoAlpha: 0, x: 0, y: 0, scale: 1, rotationY: 0 });
gsap.set("#flow-fill", { scaleX: 0 });
gsap.set(".flow-node", { opacity: 0, y: 25 });
gsap.set("#failure-ring", { opacity: 0 });
gsap.set("#paid, #failed", { yPercent: 115 });
gsap.set("#hero .eyebrow, #hero-note", { opacity: 0 });
gsap.set("#progress", { scaleX: 0 });
gsap.set(
  "#dashboard, #run-film, .section-title span, #run-caption, .stage-label, #failure-focus, #diagnostic-caption, #transaction h1 span, #transaction .eyebrow, #transaction-caption, #trace-link b, #file, #file code, #file .saved, #export-caption, #logo, #logo span, #outro-line, #features span",
  { opacity: 0 },
);
gsap.set("#trace-link span", { scaleX: 0 });
gsap.set("#repo", { clipPath: "inset(0 100% 0 0)" });
// One continuous composition: the lifecycle rail survives the camera changes.
tl.to("#grid", { x: 80, y: -80, duration, ease: "none" }, 0);
tl.to("#halo", { x: 240, y: 170, duration, ease: "sine.inOut" }, 0);
tl.to("#progress", { scaleX: 1, duration, ease: "none" }, 0);
tl.to("#hero .eyebrow", { opacity: 1, duration: 0.4 }, 0.05);
tl.to("#paid", { yPercent: 0, duration: 0.75, ease: "power4.out" }, 0.14);
tl.to("#failed", { yPercent: 0, duration: 0.7, ease: "power4.out" }, 0.86);
tl.to("#hero-note", { opacity: 1, duration: 0.4 }, 1.55);
tl.to(".flow-node", { opacity: 1, y: 0, stagger: 0.13, duration: 0.4 }, 0.42);
tl.to(
  "#flow-fill",
  { scaleX: 0.88, duration: 1.25, ease: "power2.inOut" },
  0.65,
);
tl.to("#flow-fill", { backgroundColor: "#f489a7", duration: 0.25 }, 1.85);
tl.fromTo(
  "#failure-ring",
  { opacity: 0.9, scale: 1 },
  { opacity: 0, scale: 1.9, duration: 0.75, immediateRender: false },
  1.85,
);
tl.to(
  "#hero",
  { y: -185, scale: 0.88, opacity: 0, duration: 0.55, ease: "power3.inOut" },
  2.75,
);
tl.to(
  "#flow",
  { y: -720, scale: 0.77, duration: 0.85, ease: "power3.inOut" },
  2.9,
);
tl.set("#run", { autoAlpha: 1 }, 3);
tl.fromTo(
  "#dashboard",
  { y: 500, scale: 0.72, rotationX: 14, opacity: 0 },
  {
    y: 0,
    scale: 0.9,
    rotationX: 0,
    opacity: 1,
    duration: 0.85,
    immediateRender: false,
  },
  3.0,
);
tl.to(
  "#dashboard",
  { scale: 1.3, y: 20, opacity: 0.08, duration: 0.9, ease: "power3.inOut" },
  3.85,
);
tl.fromTo(
  "#run-film",
  { scale: 0.75, y: 90, opacity: 0, rotationY: -10 },
  {
    scale: 1,
    y: 0,
    opacity: 1,
    rotationY: 0,
    duration: 0.7,
    immediateRender: false,
  },
  4.05,
);
tl.fromTo(
  "#run .section-title span",
  { y: 60, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, immediateRender: false },
  3.65,
);
tl.fromTo(
  "#run-caption",
  { y: 20, opacity: 0 },
  { y: 0, opacity: 1, immediateRender: false },
  4.7,
);
tl.to("#run-film", { scale: 1.04, y: -8, duration: 3.2, ease: "none" }, 4.9);
tl.to(
  "#run",
  { x: -700, opacity: 0, rotationY: 8, duration: 0.7, ease: "power3.inOut" },
  8.1,
);
tl.set("#run", { autoAlpha: 0 }, 8.9);
tl.set("#inspect", { autoAlpha: 1 }, 8.2);
tl.fromTo(
  "#trace-film",
  { x: 1500, rotationY: -15, scale: 1.15 },
  {
    x: 0,
    rotationY: 0,
    scale: 1,
    duration: 0.85,
    ease: "power3.inOut",
    immediateRender: false,
  },
  8.2,
);
tl.fromTo(
  "#inspect .section-title span",
  { y: 75, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.08, immediateRender: false },
  8.75,
);
for (const [selector, time] of [
  ["#verified", 9.3],
  ["#settled", 10.1],
  ["#delivery", 11.0],
] as const) {
  tl.fromTo(
    selector,
    { x: -50, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.45, immediateRender: false },
    time,
  );
}
tl.fromTo(
  "#failure-focus",
  { clipPath: "inset(0 100% 0 0)", opacity: 0 },
  {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    duration: 0.55,
    immediateRender: false,
  },
  11.1,
);
tl.fromTo(
  "#diagnostic-caption",
  { y: 25, opacity: 0 },
  { y: 0, opacity: 1, immediateRender: false },
  11.65,
);
tl.to(
  "#trace-film, #failure-focus",
  { x: -30, scale: 1.035, duration: 2, ease: "sine.inOut" },
  11.7,
);
tl.to(
  "#inspect",
  { y: -700, opacity: 0, scale: 0.9, duration: 0.65, ease: "power3.inOut" },
  13.5,
);
tl.set("#inspect", { autoAlpha: 0 }, 14.2);
tl.set("#transaction", { autoAlpha: 1 }, 13.75);
tl.fromTo(
  "#transaction-film",
  { y: 900, rotationZ: 4 },
  {
    y: 0,
    rotationZ: 0,
    duration: 0.8,
    ease: "power3.inOut",
    immediateRender: false,
  },
  13.75,
);
tl.fromTo(
  "#transaction h1 span",
  { y: 70, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.1, immediateRender: false },
  14.1,
);
tl.fromTo(
  "#transaction .eyebrow, #transaction-caption",
  { opacity: 0 },
  { opacity: 1, stagger: 0.15, immediateRender: false },
  14.4,
);
tl.fromTo(
  "#trace-link span",
  { scaleX: 0 },
  { scaleX: 1, duration: 0.65, immediateRender: false },
  15.0,
);
tl.fromTo(
  "#trace-link b",
  { opacity: 0 },
  { opacity: 1, immediateRender: false },
  15.3,
);
tl.to(
  "#transaction-film",
  { y: -18, x: -18, scale: 1.035, duration: 1.5, ease: "sine.inOut" },
  15.7,
);
tl.to(
  "#transaction",
  { x: -1600, duration: 0.65, ease: "power3.inOut" },
  17.25,
);
tl.set("#transaction", { autoAlpha: 0 }, 17.95);
tl.set("#evidence", { autoAlpha: 1 }, 17.4);
tl.fromTo(
  "#export-film",
  { x: 1600, rotationY: -12 },
  {
    x: 0,
    rotationY: 0,
    duration: 0.8,
    ease: "power3.inOut",
    immediateRender: false,
  },
  17.4,
);
tl.fromTo(
  "#evidence .section-title span",
  { y: 65, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.08, immediateRender: false },
  17.85,
);
tl.fromTo(
  "#file",
  { x: -500, y: -60, scale: 0.85, rotation: -8, opacity: 0 },
  {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    duration: 0.9,
    ease: "power3.out",
    immediateRender: false,
  },
  19.05,
);
tl.fromTo(
  "#file code, #file .saved",
  { y: 20, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.2, immediateRender: false },
  19.7,
);
tl.fromTo(
  "#export-caption",
  { opacity: 0 },
  { opacity: 1, immediateRender: false },
  20.2,
);
tl.to("#file", { y: -15, duration: 1.3, ease: "sine.inOut" }, 20.8);
// An editorial wipe joins the export to the wordmark, with no slide crossfade.
tl.to("#wipe", { x: "110%", duration: 0.8, ease: "power3.inOut" }, 22.4);
tl.set("#evidence, #flow", { autoAlpha: 0 }, 22.8);
tl.set("#outro", { autoAlpha: 1 }, 22.8);
tl.fromTo(
  "#logo",
  { y: 95, scale: 0.9, opacity: 0 },
  {
    y: 0,
    scale: 1,
    opacity: 1,
    duration: 0.9,
    ease: "power4.out",
    immediateRender: false,
  },
  22.9,
);
tl.fromTo(
  "#logo span",
  { rotation: -22, y: -40, opacity: 0, transformOrigin: "50% 80%" },
  {
    rotation: 0,
    y: 0,
    opacity: 1,
    duration: 0.65,
    ease: "back.out(1.4)",
    immediateRender: false,
  },
  23.15,
);
tl.fromTo(
  "#outro-line",
  { y: 32, opacity: 0 },
  { y: 0, opacity: 1, duration: 0.65, immediateRender: false },
  23.65,
);
tl.fromTo(
  "#features span",
  { y: 25, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.08, immediateRender: false },
  24.1,
);
tl.fromTo(
  "#repo",
  { clipPath: "inset(0 100% 0 0)", y: 15 },
  { clipPath: "inset(0 0% 0 0)", y: 0, duration: 0.8, immediateRender: false },
  24.45,
);
tl.to(
  "#repo b",
  { x: 8, y: -8, duration: 0.4, repeat: 1, yoyo: true, ease: "power2.inOut" },
  25.8,
);

const chapters = [
  [0, "THE FAILURE"],
  [3, "REPRODUCE"],
  [8.6, "DIAGNOSE"],
  [13.9, "INSPECT"],
  [17.7, "EXPORT"],
  [22.8, "SETTLED?"],
] as const;
async function renderAt(time: number) {
  tl.time(Math.max(0, Math.min(duration, time)), false);
  // Explicit visibility avoids inherited autoAlpha state when scrubbing backwards.
  for (const [selector, start, end] of [
    ["#run", 3, 8.9],
    ["#inspect", 8.2, 14.2],
    ["#transaction", 13.75, 17.95],
    ["#evidence", 17.4, 22.8],
    ["#outro", 22.8, 28.1],
  ] as const) {
    $(selector).style.visibility =
      time >= start && time < end ? "visible" : "hidden";
  }
  $("#chapter").textContent = [...chapters]
    .reverse()
    .find(([start]) => time >= start)![1];
  for (const clip of clips) {
    if (time < clip.start - 0.7 || time > clip.end + 0.3) continue;
    const video = videos.find((item) => item.dataset.shot === clip.name)!;
    const local = Math.max(0, time - clip.start);
    const target =
      clip.name === "simulate"
        ? Math.min(
            video.duration - 0.05,
            clip.offset +
              (local / (clip.end - clip.start)) *
                (video.duration - clip.offset - 0.05),
          )
        : Math.min(video.duration - 0.05, local + clip.offset);
    if (Math.abs(video.currentTime - target) > 0.006) {
      await new Promise<void>((done, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error(`Video seek stalled: ${clip.name}`)),
          5000,
        );
        video.addEventListener(
          "seeked",
          () => {
            clearTimeout(timeout);
            done();
          },
          { once: true },
        );
        video.currentTime = target;
      });
    }
  }
  if (reduce) {
    gsap.set("#grid, #halo", { opacity: 0 });
  }
}

async function init() {
  const exported = await (await fetch("/assets/export.json")).json();
  $("#file code").textContent = JSON.stringify(
    {
      id: exported.trace.id.slice(0, 13) + "…",
      outcome: exported.trace.outcome,
      version: exported.version,
    },
    null,
    2,
  );
  await Promise.all(
    videos.map(
      (video) =>
        new Promise<void>((done, reject) => {
          video.addEventListener("loadeddata", () => done(), { once: true });
          video.addEventListener(
            "error",
            () => reject(new Error(`Missing media: ${video.dataset.shot}`)),
            { once: true },
          );
          video.src = `/assets/${video.dataset.shot}.mp4`;
          video.load();
        }),
    ),
  );
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode()));
  await renderAt(0);
  Object.assign(window, {
    renderAt,
    motion: { duration, timeline: tl, clips },
  });
}
void init();
