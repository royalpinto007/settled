import { gsap } from "gsap";

type Camera = { x: number; y: number; scale: number };
type Point = { x: number; y: number };
type Metrics = {
  cameras: Record<string, Camera>;
  points: Record<string, Point>;
};
const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const duration = 28;

function setupMotion(metrics: Metrics) {
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: "power3.out", duration: 0.6 },
  });
  const product = document.querySelector<HTMLIFrameElement>("#product-camera")!;
  const cursor = product.contentDocument!.getElementById("film-cursor")!;
  gsap.set(".scene", { autoAlpha: 0, x: 0, y: 0, scale: 1 });
  gsap.set("#hero", {
    opacity: 1,
    visibility: "visible",
    x: 0,
    y: 0,
    scale: 1,
  });
  gsap.set("#flow", {
    opacity: 1,
    visibility: "visible",
    x: 0,
    y: 0,
    scale: 1,
  });
  gsap.set("#flow-fill", { scaleX: 0 });
  gsap.set(".flow-node", { opacity: 0, y: 25 });
  gsap.set("#failure-ring", { opacity: 0 });
  gsap.set("#paid, #failed", { yPercent: 115 });
  gsap.set("#hero .eyebrow, #hero-note", { opacity: 0 });
  gsap.set("#progress", { scaleX: 0 });
  gsap.set(
    ".section-title span, .stage-label, #diagnostic-caption, #transaction h1 span, #transaction .eyebrow, #transaction-caption, #trace-link b, #file, #file code, #file .saved, #export-caption, #logo, #logo span, #outro-line, #features span",
    { opacity: 0 },
  );
  gsap.set("#trace-link span", { scaleX: 0 });
  gsap.set("#repo", { clipPath: "inset(0 100% 0 0)" });
  gsap.set("#product-window", { x: 240, y: 310, scale: 1, autoAlpha: 0 });
  gsap.set(product, { x: 0, y: 0, scale: 0.9, opacity: 1 });
  gsap.set(cursor, { ...metrics.points.new, opacity: 0 });
  function camera(name: string, at: number, seconds = 0.6) {
    tl.to(
      product,
      { ...metrics.cameras[name], duration: seconds, ease: "power3.inOut" },
      at,
    );
  }
  function pointer(name: string, at: number, clickAt: number) {
    tl.to(cursor, { ...metrics.points[name], opacity: 1, duration: 0.4 }, at);
    tl.to(
      cursor,
      { scale: 0.82, duration: 0.08, repeat: 1, yoyo: true },
      clickAt,
    );
  }
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

  // One live window keeps the app's spatial identity through every task.
  tl.set("#run", { autoAlpha: 1 }, 3);
  tl.fromTo(
    "#product-window",
    { y: 580, scale: 0.9, rotationX: 8, autoAlpha: 0 },
    {
      x: 240,
      y: 310,
      scale: 1,
      rotationX: 0,
      autoAlpha: 1,
      duration: 0.8,
      immediateRender: false,
    },
    3,
  );
  tl.fromTo(
    "#run .section-title span",
    { y: 55, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.07, immediateRender: false },
    3.25,
  );
  pointer("new", 3.5, 4);
  camera("modal", 4.08, 0.6);
  pointer("scenario", 4.45, 4.9);
  pointer("option", 5.1, 5.55);
  pointer("run", 6.05, 6.9);
  camera("overview", 6.92, 0.65);
  tl.to(cursor, { opacity: 0, duration: 0.2 }, 7.3);
  tl.to("#run", { y: -45, opacity: 0, duration: 0.4 }, 7.7);
  // Reframe only while the app surface is concealed. The window chrome persists.
  tl.to(product, { opacity: 0, duration: 0.14 }, 7.72);
  tl.to(
    "#product-window",
    { x: 650, y: 350, scale: 0.78, duration: 0.75, ease: "power3.inOut" },
    7.75,
  );
  camera("timeline", 7.91, 0.01);
  tl.to(product, { opacity: 1, duration: 0.25 }, 8.05);
  tl.set("#inspect", { autoAlpha: 1 }, 8.05);
  tl.fromTo(
    "#inspect .section-title span",
    { y: 50, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.07, immediateRender: false },
    8.15,
  );
  for (const [selector, time] of [
    ["#verified", 9.1],
    ["#settled", 10],
    ["#delivery", 10.9],
  ] as const)
    tl.fromTo(
      selector,
      { x: -35, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.4, immediateRender: false },
      time,
    );
  camera("focus", 9.8, 0.8);
  tl.fromTo(
    "#diagnostic-caption",
    { y: 20, opacity: 0 },
    { y: 0, opacity: 1, immediateRender: false },
    11.45,
  );
  camera("timeline", 13.05, 0.6);
  pointer("transaction", 13.2, 13.8);
  tl.to("#inspect", { y: -45, opacity: 0, duration: 0.4 }, 13.45);
  tl.to(
    "#product-window",
    { x: 780, y: 310, scale: 0.72, duration: 0.7, ease: "power3.inOut" },
    13.5,
  );
  tl.to(product, { opacity: 0, duration: 0.12 }, 13.65);
  camera("transaction", 13.81, 0.01);
  tl.to(product, { opacity: 1, duration: 0.22 }, 13.88);
  tl.set("#transaction", { autoAlpha: 1 }, 13.8);
  tl.fromTo(
    "#transaction h1 span",
    { y: 55, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.08, immediateRender: false },
    13.95,
  );
  tl.fromTo(
    "#transaction .eyebrow, #transaction-caption",
    { opacity: 0 },
    { opacity: 1, stagger: 0.15, immediateRender: false },
    14.2,
  );
  tl.fromTo(
    "#trace-link span",
    { scaleX: 0 },
    { scaleX: 1, immediateRender: false },
    14.8,
  );
  tl.fromTo(
    "#trace-link b",
    { opacity: 0 },
    { opacity: 1, immediateRender: false },
    15.15,
  );
  tl.to(cursor, { opacity: 0, duration: 0.2 }, 14.2);
  pointer("json", 17.05, 17.65);
  tl.to("#transaction", { y: -45, opacity: 0, duration: 0.4 }, 17.3);
  tl.to(
    "#product-window",
    { x: 155, y: 340, scale: 0.73, duration: 0.7, ease: "power3.inOut" },
    17.35,
  );
  tl.to(product, { opacity: 0, duration: 0.12 }, 17.51);
  camera("json", 17.66, 0.01);
  tl.to(product, { opacity: 1, duration: 0.22 }, 17.75);
  tl.set("#evidence", { autoAlpha: 1 }, 17.7);
  tl.fromTo(
    "#evidence .section-title span",
    { y: 50, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.07, immediateRender: false },
    17.8,
  );
  pointer("export", 18.55, 19.05);
  tl.fromTo(
    "#file",
    { x: -70, y: 25, scale: 0.94, opacity: 0 },
    { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.7, immediateRender: false },
    19.12,
  );
  tl.fromTo(
    "#file code, #file .saved",
    { y: 15, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.18, immediateRender: false },
    19.65,
  );
  tl.fromTo(
    "#export-caption",
    { opacity: 0 },
    { opacity: 1, immediateRender: false },
    20,
  );
  tl.to(cursor, { opacity: 0, duration: 0.2 }, 19.5);
  // An editorial wipe joins the export to the wordmark, with no slide crossfade.
  tl.to("#wipe", { x: "110%", duration: 0.8, ease: "power3.inOut" }, 22.4);
  tl.set("#evidence, #flow, #product-window", { autoAlpha: 0 }, 22.8);
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
    {
      clipPath: "inset(0 0% 0 0)",
      y: 0,
      duration: 0.8,
      immediateRender: false,
    },
    24.45,
  );
  tl.to(
    "#repo b",
    { x: 8, y: -8, duration: 0.4, repeat: 1, yoyo: true, ease: "power2.inOut" },
    25.8,
  );

  function renderAt(time: number) {
    tl.time(Math.max(0, Math.min(duration, time)), false);
    for (const [selector, start, end] of [
      ["#run", 3, 8.1],
      ["#inspect", 8.05, 13.95],
      ["#transaction", 13.8, 17.8],
      ["#evidence", 17.7, 22.8],
      ["#outro", 22.8, 28.1],
    ] as const)
      $(selector).style.visibility =
        time >= start && time < end ? "visible" : "hidden";
    $("#product-window").style.visibility =
      time >= 3 && time < 22.8 ? "visible" : "hidden";
    $("#product-viewport").style.backgroundColor =
      time >= 7.9 ? "#191c25" : "#101218";
    $("#product-view").textContent =
      time >= 17.65
        ? "JSON / LIVE EXPORT"
        : time >= 13.8
          ? "TRANSACTION / LIVE VIEW"
          : time >= 7.9
            ? "TIMELINE / LIVE VIEW"
            : "LIVE DASHBOARD";
    $("#chapter").textContent =
      time >= 22.8
        ? "SETTLED?"
        : time >= 17.7
          ? "EXPORT"
          : time >= 13.8
            ? "INSPECT"
            : time >= 8
              ? "DIAGNOSE"
              : time >= 3
                ? "REPRODUCE"
                : "THE FAILURE";
  }
  function setEvidence(exported: {
    version: number;
    trace: { id: string; outcome: string };
  }) {
    $("#file code").textContent = JSON.stringify(
      {
        id: exported.trace.id.slice(0, 13) + "…",
        outcome: exported.trace.outcome,
        version: exported.version,
      },
      null,
      2,
    );
  }
  Object.assign(window, {
    renderAt,
    setEvidence,
    motion: { duration, timeline: tl },
  });
  renderAt(0);
  gsap.ticker.sleep();
}
Object.assign(window, { setupMotion });
