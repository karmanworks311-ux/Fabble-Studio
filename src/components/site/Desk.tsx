"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { ArrowUp, ArrowUpRight, Laptop, MousePointer2, Lightbulb, LightbulbOff, Smartphone, X } from "lucide-react";
import type { SiteProject } from "@/lib/work";
import { useStored } from "@/lib/useStored";
import { cn } from "@/lib/utils";
import { PhoneDevice } from "./Phone";
import { LaptopDevice } from "./Laptop";
import { lockScroll, unlockScroll } from "./scroll";

// three.js only loads in the browser, and only once the desk is near the viewport
const loadScene = () => import("./DeskScene");
const DeskScene = dynamic(loadScene, { ssr: false });
type ScreenRect = { x: number; y: number; w: number; h: number };

/** An element's offset inside `root`, ignoring transforms (offsetParent chain). */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

function hasWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

type Mode = "desk" | "phone" | "laptop";
type Box = { sw: number; sh: number; lw: number; lh: number; pw: number; ph: number };
type Place = { x: number; y: number; scale: number };

/** Where everything sits for a stage size: both devices resting on the desk, or one picked up. */
function arrange(b: Box) {
  const mobile = b.sw < 768;
  const gap = Math.max(16, b.sw * 0.05);
  // the phone stands a little shorter than the laptop; the pair must fit the stage width
  const pairW = (s: number) => b.lw * s + ((b.lh * s * 0.92) / b.ph) * b.pw;
  let lScale = Math.min((b.sw * (mobile ? 0.58 : 0.46)) / b.lw, (b.sh * 0.5) / b.lh);
  lScale *= Math.min(1, (b.sw * 0.9 - gap) / pairW(lScale));
  const lw = b.lw * lScale;
  const lh = b.lh * lScale;
  const pScale = (lh * 0.92) / b.ph;
  const pw = b.pw * pScale;
  const ph = b.ph * pScale;
  // centre the pair, nudged right of the lamp on wide stages
  const left = (b.sw - (lw + gap + pw)) / 2 + (mobile ? 0 : b.sw * 0.05);
  const lcx = left + lw / 2;
  const pcx = left + lw + gap + pw / 2;
  const floor = b.sh * (mobile ? 0.76 : 0.8);

  const at = (cx: number, cy: number, scale: number): Place => ({ x: cx - b.sw / 2, y: cy - b.sh / 2, scale });
  const fit = (w: number, h: number, top: number) => Math.min(1, (b.sw * 0.94) / w, (b.sh - top - 16) / h);
  // picked up, the laptop is framed on its screen (lid ≈ 84% wide, 0.56 × width tall); the keyboard runs off the bottom
  const lFocus = Math.min(1.25, (b.sw * 0.94) / (b.lw * 0.84), (b.sh - 64 - 20) / (b.lw * 0.56));
  const pFocus = fit(b.pw, b.ph, 64);

  return {
    desk: { laptop: at(lcx, floor - lh / 2, lScale), phone: at(pcx, floor - ph / 2 - lh * 0.03, pScale) },
    laptop: at(b.sw / 2, 64 + (b.lh * lFocus) / 2, lFocus),
    phone: at(b.sw / 2, 64 + (b.ph * pFocus) / 2, pFocus),
    lamp: { h: b.sh * (mobile ? 0.42 : 0.62), bottom: b.sh * (1 - (mobile ? 0.7 : 0.74)) },
  };
}

/**
 * The work showcase: a laptop and a phone resting on a desk under a lamp. Picking one up zooms it in,
 * wakes it and (the first time) plays a short demo; putting it down returns to the desk.
 */
export function Desk() {
  const stage = useRef<HTMLDivElement>(null);
  const laptop = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [mode, setMode] = useState<Mode>("desk");
  const [lamp, setLamp] = useState(true);
  const [site, setSite] = useState<SiteProject | null>(null);
  const [seen, setSeen] = useStored("fabble-demo-seen", { phone: false, laptop: false });
  const reduce = useRef(false);
  // 3D desk where WebGL works and motion is welcome; otherwise the flat CSS desk
  const [three, setThree] = useState<boolean | null>(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  // in 3D, the live screen appears once the camera has flown in
  const [arrived, setArrived] = useState(false);
  const [ready, setReady] = useState(false);
  const [screenRect, setScreenRect] = useState<ScreenRect | null>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "1200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // fetch the 3D code once the page is idle, so it is usually ready before anyone scrolls here
  useEffect(() => {
    if (!three) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => void loadScene());
  }, [three]);

  useEffect(() => {
    if (mode === "desk") return setArrived(false);
    if (!three) return setArrived(true);
    const t = setTimeout(() => setArrived(true), 950);
    return () => clearTimeout(t);
  }, [mode, three]);

  useLayoutEffect(() => {
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setThree(hasWebGL() && !reduce.current);
    const measure = () => {
      const s = stage.current;
      const l = laptop.current;
      const p = phone.current;
      if (s && l && p && s.clientWidth && s.clientHeight && l.offsetWidth && l.offsetHeight && p.offsetWidth && p.offsetHeight)
        setBox({ sw: s.clientWidth, sh: s.clientHeight, lw: l.offsetWidth, lh: l.offsetHeight, pw: p.offsetWidth, ph: p.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    [stage, laptop, phone].forEach((r) => r.current && ro.observe(r.current));
    return () => ro.disconnect();
  }, []);

  // holding a device: bring the stage into view, freeze the page, Esc puts it down
  useEffect(() => {
    if (mode === "desk") return;
    // line the stage's bottom up with the viewport's, so the site nav never covers its top bar
    const r = stage.current?.getBoundingClientRect();
    if (r) scrollBy({ top: r.bottom - innerHeight + 12, behavior: reduce.current ? "auto" : "smooth" });
    // freeze the page only after that scroll lands: hiding overflow mid-scroll cancels it
    let locked = false;
    const t = setTimeout(
      () => {
        lockScroll();
        locked = true;
      },
      reduce.current ? 0 : 600,
    );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode("desk");
    addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      if (locked) unlockScroll();
      removeEventListener("keydown", onKey);
    };
  }, [mode]);

  const onSite = useCallback((s: SiteProject | null) => setSite(s), []);
  const a = box && arrange(box);
  // only read after a device is picked up, so it never runs during server render
  const verb = mode !== "desk" && matchMedia("(pointer: coarse)").matches ? "Tap" : "Click";
  const spring = reduce.current ? { duration: 0 } : { type: "spring" as const, damping: 30, stiffness: 140, mass: 1.1 };

  // where the device must sit (and what to clip) so its screen covers `r`, the 3D screen's rect in the stage
  const overlay = (which: "laptop" | "phone", r: ScreenRect) => {
    const root = (which === "laptop" ? laptop : phone).current;
    const scr = root?.querySelector<HTMLElement>("[data-screen]");
    if (!root || !scr || !box) return null;
    const host = root.parentElement!;
    const s = r.w / scr.offsetWidth;
    const o = offsetIn(scr, host);
    const rw = host.offsetWidth;
    const rh = host.offsetHeight;
    return {
      place: { x: r.x - o.x * s + (rw * s) / 2 - box.sw / 2, y: r.y - o.y * s + (rh * s) / 2 - box.sh / 2, scale: s },
      clip: `inset(${o.y}px ${rw - o.x - scr.offsetWidth}px ${rh - o.y - scr.offsetHeight}px ${o.x}px round ${which === "phone" ? 46 : 6}px)`,
    };
  };

  const place = (which: "laptop" | "phone") => {
    if (!a) return { opacity: 0 };
    // 3D: the live screen is laid exactly over the 3D one and shows once the camera has arrived
    if (three) {
      const fit = mode === which && screenRect && overlay(which, screenRect);
      return fit ? { ...fit.place, opacity: arrived ? 1 : 0 } : { ...a[which], opacity: 0 };
    }
    if (mode === "desk") return { ...a.desk[which], opacity: 1 };
    if (mode === which) return { ...a[which], opacity: 1 };
    // the other device slides off and fades
    const d = a.desk[which];
    return { ...d, x: d.x + (which === "laptop" ? -1 : 1) * box!.sw * 0.4, opacity: 0 };
  };

  const label =
    mode === "desk"
      ? three
        ? "Pick up a device to try it · click the lamp to switch it"
        : "Pick up a device to try it"
      : mode === "phone"
        ? "Swipe for reels · tap for sound · like, comment, share"
        : site
          ? `${site.name} · ${site.category} · ${site.year}`
          : "Open a project from the dock";

  return (
    <div ref={stage} className={cn("desk relative isolate h-[clamp(560px,calc(100svh-96px),940px)] overflow-hidden")}>
      {three && (
        <>
          {/* skeleton with a shimmer until the 3D desk has drawn its first frame */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 transition-opacity duration-700",
              ready ? "opacity-0" : "opacity-100",
            )}
          >
            <div className="flex items-end gap-[4vw]">
              <div className="w-[min(58vw,560px)]">
                <div className="skeleton aspect-[16/10] rounded-t-xl" />
                <div className="skeleton -mx-[6%] h-[min(4vw,30px)] [clip-path:polygon(4%_0,96%_0,100%_100%,0_100%)]" />
              </div>
              <div className="skeleton aspect-[9/19.5] w-[min(16vw,130px)] rounded-2xl" />
            </div>
            <p className="text-xs text-mist">Setting up the desk…</p>
          </div>
          {near && (
            <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
              <DeskScene
                focus={mode}
                lamp={lamp}
                onToggleLamp={() => setLamp(!lamp)}
                onPick={setMode}
                onScreenRect={setScreenRect}
                onReady={() => setReady(true)}
                active={inView}
              />
            </div>
          )}
        </>
      )}

      {/* flat desk: wall glow + desk surface */}
      {three === false && (
        <>
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_50%_at_60%_20%,rgba(99,34,230,0.18),transparent_70%)]" />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 -z-10 h-[38%] border-t border-[rgba(255,220,180,0.08)] transition-[filter] duration-700"
            style={{
              background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 9px), linear-gradient(180deg, #2a1c13, #110b08)",
              filter: lamp ? "brightness(1)" : "brightness(0.45)",
            }}
          />

          {/* lamp + its light */}
          {a && box && <Lamp on={lamp} toggle={() => setLamp(!lamp)} h={a.lamp.h} bottom={a.lamp.bottom} sw={box.sw} sh={box.sh} />}
        </>
      )}

      {/* holding a device: a click anywhere off it puts it down (the "Put it down" button is easy to miss) */}
      {mode !== "desk" && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => setMode("desk")} className="absolute inset-0 z-[5] cursor-zoom-out" />
      )}

      {/* devices */}
      {(["laptop", "phone"] as const).map((which) => {
        const held = mode === which;
        return (
          <div key={which} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <motion.div
              initial={false}
              animate={place(which)}
              // 3D: follow the screen exactly, only fade in and out
              transition={three ? { duration: 0, opacity: { duration: reduce.current ? 0 : 0.35 } } : spring}
              style={three && held && screenRect ? { clipPath: overlay(which, screenRect)?.clip } : undefined}
              className={cn("relative shrink-0", (three ? held && arrived : mode === "desk" || held) && "pointer-events-auto")}
            >
              {/* contact shadow on the desk */}
              <motion.span
                aria-hidden
                animate={{ opacity: mode === "desk" && three === false ? 1 : 0 }}
                className="absolute inset-x-[6%] -bottom-[3%] h-[7%] rounded-[50%] bg-black/70 blur-xl"
              />
              <div ref={which === "laptop" ? laptop : phone}>
                {which === "laptop" ? (
                  <LaptopDevice
                    awake={held && arrived}
                    demo={!seen.laptop}
                    onDemoDone={() => setSeen({ ...seen, laptop: true })}
                    onSite={onSite}
                    onOpenPhone={() => setMode("phone")}
                  />
                ) : (
                  <PhoneDevice awake={held && arrived} demo={!seen.phone} onDemoDone={() => setSeen({ ...seen, phone: true })} />
                )}
              </div>
              {/* resting on the desk the whole device is one big "pick me up" target */}
              {mode === "desk" && three === false && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => setMode(which)}
                  data-cursor="hover"
                  className="absolute inset-0 z-[80] cursor-pointer"
                />
              )}
            </motion.div>
          </div>
        );
      })}

      {/* use buttons */}
      <motion.div
        initial={false}
        animate={{ opacity: mode === "desk" ? 1 : 0, y: mode === "desk" ? 0 : 12 }}
        className={cn("absolute inset-x-0 bottom-5 z-20 flex justify-center gap-3 md:bottom-8", mode !== "desk" && "pointer-events-none")}
      >
        {(["laptop", "phone"] as const).map((which) => (
          <button key={which} type="button" onClick={() => setMode(which)} data-cursor="hover" tabIndex={mode === "desk" ? 0 : -1}>
            <span className="group/use flex items-center gap-2.5 whitespace-nowrap rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-4 text-xs font-medium text-paper ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.14] sm:text-sm">
              <span className="flex size-7 items-center justify-center rounded-full bg-paper text-ink transition-transform group-hover/use:scale-110 sm:size-8">
                {which === "laptop" ? <Laptop className="size-4" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
              </span>
              Use {which}
            </span>
          </button>
        ))}
      </motion.div>

      {/* laptop how-to at a readable size: the in-screen hint shrinks to a few pixels on phones */}
      <motion.div
        initial={false}
        animate={{ opacity: mode === "laptop" && arrived ? 1 : 0, y: mode === "laptop" && arrived ? 0 : 12 }}
        aria-live="polite"
        // landscape: the laptop fills the stage and the card would cover its dock; the top label guides there
        className="pointer-events-none absolute inset-x-3 bottom-5 z-[90] flex justify-center md:bottom-8 landscape:hidden"
      >
        <div className="flex max-w-md items-start gap-3 rounded-2xl bg-ink/85 px-4 py-3 text-left ring-1 ring-white/15 backdrop-blur-md">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-ink">
            {site ? <MousePointer2 className="size-4" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
          </span>
          <div>
            <p className="text-sm font-semibold text-paper md:text-base">
              {site ? `Scroll inside the screen to explore ${site.name}` : `${verb} a logo in the laptop's dock to open a project`}
            </p>
            <p className="mt-0.5 text-xs text-mist md:text-sm">
              {site ? `${verb} another logo to switch · ` : ""}
              {verb} outside the laptop to put it down
            </p>
          </div>
        </div>
      </motion.div>

      {/* top bar: lamp switch, what to do, put it down */}
      <div className="absolute inset-x-3 top-3 z-[90] flex items-center gap-3 md:inset-x-5 md:top-5">
        <button
          type="button"
          onClick={() => setLamp(!lamp)}
          aria-pressed={lamp}
          data-cursor="hover"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-paper ring-1 ring-white/15 backdrop-blur hover:bg-white/15"
        >
          {lamp ? <Lightbulb className="size-3.5 text-[#ffc36b]" aria-hidden /> : <LightbulbOff className="size-3.5" aria-hidden />}
          <span className="hidden sm:inline">Lamp {lamp ? "on" : "off"}</span>
        </button>
        <p aria-live="polite" className="min-w-0 flex-1 text-balance text-center text-xs leading-snug text-mist md:text-sm">
          {label}
          {mode === "laptop" && site?.url && (
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-paper underline-offset-2 hover:underline"
            >
              Visit <ArrowUpRight className="size-3" aria-hidden />
            </a>
          )}
        </p>
        <button
          type="button"
          onClick={() => setMode("desk")}
          data-cursor="hover"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-opacity",
            mode === "desk" && "pointer-events-none opacity-0",
          )}
          tabIndex={mode === "desk" ? -1 : 0}
        >
          <X className="size-3.5" aria-hidden />
          Put it down
        </button>
      </div>
    </div>
  );
}

/** A desk lamp drawn in SVG; clicking it toggles the light it throws across the desk. */
function Lamp({ on, toggle, h, bottom, sw, sh }: { on: boolean; toggle: () => void; h: number; bottom: number; sw: number; sh: number }) {
  const w = h * 0.4;
  const left = sw * 0.03;
  const top = sh - bottom - h;
  // the bulb, in stage pixels (viewBox 120 x 300)
  const bx = left + (103 / 120) * w;
  const by = top + (88 / 300) * h;
  const spread = sw * 0.75;

  return (
    <>
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute inset-0 z-[5] blur-md"
      >
        {/* cone */}
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            clipPath: `polygon(${bx - 8}px ${by}px, ${bx + 10}px ${by}px, ${bx + spread * 0.75}px ${sh}px, ${bx - spread * 0.2}px ${sh}px)`,
            background: `radial-gradient(circle at ${bx}px ${by}px, rgba(255,200,130,0.32), rgba(255,180,110,0.08) 55%, transparent 85%)`,
          }}
        />
        {/* pool of light on the desk */}
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: `radial-gradient(${spread * 0.42}px ${sh * 0.16}px at ${bx + spread * 0.25}px ${sh * 0.86}px, rgba(255,190,120,0.3), transparent 75%)`,
          }}
        />
      </motion.div>
      <button
        type="button"
        onClick={toggle}
        aria-label={on ? "Turn the lamp off" : "Turn the lamp on"}
        data-cursor="hover"
        className="absolute z-[4]"
        style={{ left, top, width: w, height: h }}
      >
        <svg viewBox="0 0 120 300" className="size-full overflow-visible">
          <defs>
            <linearGradient id="lamp-metal" x1="0" x2="1">
              <stop offset="0" stopColor="#3a3a44" />
              <stop offset="1" stopColor="#1c1c22" />
            </linearGradient>
          </defs>
          <ellipse cx="30" cy="294" rx="30" ry="6" fill="black" opacity="0.5" />
          <rect x="4" y="280" width="52" height="13" rx="6.5" fill="url(#lamp-metal)" />
          <path d="M30 282 L52 120 L100 66" fill="none" stroke="#2c2c34" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="52" cy="120" r="6" fill="#3a3a44" />
          <circle cx="100" cy="66" r="5" fill="#3a3a44" />
          <path d="M86 56 Q104 42 120 62 L128 94 L80 82 Z" fill="url(#lamp-metal)" stroke="#4a4a55" strokeWidth="1" />
          <ellipse cx="104" cy="88" rx="22" ry="5" transform="rotate(14 104 88)" fill={on ? "#ffe2b0" : "#2a2a30"} />
          {on && <circle cx="104" cy="88" r="16" fill="#ffd28a" opacity="0.35" style={{ filter: "blur(6px)" }} />}
        </svg>
      </button>
    </>
  );
}
