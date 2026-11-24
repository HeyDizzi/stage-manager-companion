import { Cache, closeMainWindow, getPreferenceValues, showHUD, WindowManagement } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";

export type Layout = "maximize" | "left" | "right";

interface Preferences {
  stageWidth?: string;
  gap?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ScreenArea {
  frame: Rect;
  visible: Rect;
}

const cache = new Cache();
const CACHE_KEY = "screens";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Reads every screen's full and visible (minus menu bar / Dock) frame, in the
// top-left coordinate space windows use. Slow (spawns osascript), so cached.
const screensScript = `
ObjC.import("AppKit");
const screens = $.NSScreen.screens.js;
const primaryHeight = screens[0].frame.size.height;
const toTopLeft = (r) => ({
  x: r.origin.x,
  y: primaryHeight - (r.origin.y + r.size.height),
  w: r.size.width,
  h: r.size.height,
});
JSON.stringify(screens.map((s) => ({ frame: toTopLeft(s.frame), visible: toTopLeft(s.visibleFrame) })));
`;

async function getScreens(): Promise<ScreenArea[]> {
  // Re-measure only when the set of displays changes (plugging in a monitor, etc).
  const desktops = await WindowManagement.getDesktops();
  const signature = [...new Set(desktops.map((d) => `${d.screenId}:${d.size.width}x${d.size.height}`))]
    .sort()
    .join("|");

  const cached = cache.get(CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as { signature: string; screens: ScreenArea[] };
    if (parsed.signature === signature) return parsed.screens;
  }

  const screens = JSON.parse(await runAppleScript(screensScript, { language: "JavaScript" })) as ScreenArea[];
  cache.set(CACHE_KEY, JSON.stringify({ signature, screens }));
  return screens;
}

export async function applyLayout(layout: Layout) {
  const prefs = getPreferenceValues<Preferences>();
  const stageWidth = num(prefs.stageWidth, 180);
  const gap = num(prefs.gap, 0);
  await closeMainWindow();

  try {
    const [win, screens] = await Promise.all([WindowManagement.getActiveWindow(), getScreens()]);
    if (win.bounds === "fullscreen" || !win.positionable) return;

    // Pick the screen containing the window's center (fall back to primary).
    const cx = win.bounds.position.x + win.bounds.size.width / 2;
    const cy = win.bounds.position.y + win.bounds.size.height / 2;
    const screen =
      screens.find(({ frame: f }) => cx >= f.x && cx < f.x + f.w && cy >= f.y && cy < f.y + f.h) ?? screens[0];
    const area = screen.visible;

    const left = area.x + stageWidth + gap;
    const top = area.y + gap;
    const width = area.w - stageWidth - gap * 2;
    const height = area.h - gap * 2;
    const half = (width - gap) / 2;

    let x = left;
    let w = width;
    if (layout === "left") w = half;
    if (layout === "right") {
      x = left + half + gap;
      w = half;
    }

    await WindowManagement.setWindowBounds({
      id: win.id,
      bounds: {
        position: { x: Math.round(x), y: Math.round(top) },
        size: { width: Math.round(w), height: Math.round(height) },
      },
    });
  } catch (error) {
    console.error(error);
    await showHUD("Couldn't move window");
  }
}
