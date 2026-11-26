"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BatteryFull, ChevronLeft, ChevronRight, Clapperboard, Lock, RotateCw, Wifi } from "lucide-react";
import { sites, type SiteProject } from "@/lib/work";
import { cn } from "@/lib/utils";
import { clockMenu } from "@/lib/clock";
import { Ghost, useDemo } from "./Ghost";

/**
 * A laptop on a cooling pad. Its screen is a small desktop: each project is an app in the dock that
 * opens a browser window, one tab per site, and the page inside scrolls for real.
 */
export function LaptopDevice({
  awake,
  demo,
  onDemoDone,
  onSite,
  onOpenPhone,
}: {
  awake: boolean;
  demo: boolean;
  onDemoDone: () => void;
  onSite: (site: SiteProject | null) => void;
  onOpenPhone: () => void;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [clock, setClock] = useState("");
  const site = sites[tab];

  useEffect(() => {
    const tick = () => setClock(clockMenu(new Date()));
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, []);

  // closing the lid closes the window
  useEffect(() => {
    if (!awake) setOpen(false);
  }, [awake]);

  useEffect(() => onSite(open ? site : null), [open, site, onSite]);

  // each site's scroll position, so a minimised window comes back where it was
  const scrolls = useRef<Record<string, number>>({});

  // dock icon: opens its site; clicking the site that is already showing minimises it
  const openSite = (i: number) => {
    if (open && tab === i) return setOpen(false);
    setTab(i);
    setOpen(true);
  };

  const ghost = useDemo(
    awake && demo,
    screen,
    async (wait, at, set) => {
      await wait(900);
      set({ x: 50, y: 50 });
      await wait(300);
      set(at('[data-demo="dock-0"]'));
      await wait(1000);
      set({ ...at('[data-demo="dock-0"]'), down: true });
      await wait(200);
      openSite(0);
      set({ ...at('[data-demo="dock-0"]'), down: false });
      await wait(1100);
      set({ x: 55, y: 55 });
      await wait(700);
      page.current?.scrollTo({ top: page.current.clientHeight * 1.6, behavior: "smooth" });
      await wait(1500);
      if (sites.length > 1) {
        set(at('[data-demo="tab-1"]'));
        await wait(900);
        set({ ...at('[data-demo="tab-1"]'), down: true });
        await wait(200);
        setTab(1);
        set({ ...at('[data-demo="tab-1"]'), down: false });
        await wait(900);
      }
    },
    onDemoDone,
  );

  return (
    <div className="relative w-[1040px]">
      <div className="relative">
        {/* back of the cooling pad, peeking out beside the lid */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[14%] rounded-t-[14px] bg-[#16161b] ring-1 ring-white/[0.06]" />
        {/* lid */}
        <div className="relative z-10 mx-[8%] rounded-t-[22px] bg-[#0d0d12] p-[1.6%] pb-[2.4%] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/[0.1]">
          <span aria-hidden className="absolute left-1/2 top-[0.7%] size-1.5 -translate-x-1/2 rounded-full bg-white/15" />
          <div
            ref={screen}
            data-screen
            inert={!awake}
            className="relative aspect-[16/10] select-none overflow-hidden rounded-[6px] text-white ring-1 ring-white/[0.06] [container-type:inline-size]"
            style={{
              background:
                "radial-gradient(55% 75% at 15% 100%, rgba(99,34,230,0.75), transparent 70%), radial-gradient(45% 60% at 90% 5%, rgba(255,61,46,0.55), transparent 70%), radial-gradient(40% 50% at 70% 80%, rgba(34,211,238,0.25), transparent 70%), #0b0a14",
            }}
          >
            {/* desktop: big faint mark */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/logo-mark.png" alt="" aria-hidden className="absolute left-1/2 top-[44%] w-[13%] -translate-x-1/2 -translate-y-1/2 opacity-20" />

            {/* menu bar */}
            <div className="absolute inset-x-0 top-0 z-10 flex h-[3.2cqw] items-center gap-[1.6cqw] bg-black/30 px-[1.4cqw] text-[1.15cqw] backdrop-blur-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/logo-mark.png" alt="" className="size-[1.6cqw]" />
              <b className="font-semibold">Fabble Studio</b>
              <span className="text-white/75">Projects</span>
              <span className="text-white/75">View</span>
              <span className="text-white/75">Window</span>
              <span className="ml-auto flex items-center gap-[1.2cqw] text-white/85">
                <Wifi className="size-[1.4cqw]" aria-hidden />
                <BatteryFull className="size-[1.8cqw]" aria-hidden />
                <span>{clock}</span>
              </span>
            </div>

            {/* nudge until something is open */}
            <AnimatePresence>
              {awake && !open && !ghost && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-[13cqw] left-1/2 -translate-x-1/2 animate-pulse rounded-full bg-black/45 px-[1.6cqw] py-[0.6cqw] text-[1.3cqw] backdrop-blur"
                >
                  Click a project in the dock to open it
                </motion.p>
              )}
            </AnimatePresence>

            {/* browser window */}
            <AnimatePresence>
              {open && (
                <motion.div
                  key="window"
                  role="dialog"
                  aria-label={`${site.name} in a browser window`}
                  initial={{ opacity: 0, scale: 0.3, y: "45%" }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.3, y: "45%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 260 }}
                  className="absolute inset-x-[3%] bottom-[11cqw] top-[5cqw] z-20 flex origin-bottom flex-col overflow-hidden rounded-[0.9cqw] bg-[#202027] shadow-[0_2cqw_5cqw_rgba(0,0,0,0.6)] ring-1 ring-white/15"
                >
                  {/* tabs */}
                  <div className="flex h-[3.4cqw] shrink-0 items-end gap-[0.5cqw] bg-[#15151a] px-[1cqw]">
                    <span className="mb-[1.1cqw] mr-[1cqw] flex gap-[0.6cqw]">
                      <button type="button" onClick={() => setOpen(false)} aria-label="Close window" className="size-[1.1cqw] rounded-full bg-[#ff5f57]" />
                      <i aria-hidden className="size-[1.1cqw] rounded-full bg-[#febc2e]" />
                      <i aria-hidden className="size-[1.1cqw] rounded-full bg-[#28c840]" />
                    </span>
                    {sites.map((s, i) => (
                      <button
                        key={s.name}
                        type="button"
                        data-demo={`tab-${i}`}
                        onClick={() => setTab(i)}
                        aria-pressed={i === tab}
                        className={cn(
                          "flex h-[2.6cqw] w-[15cqw] items-center gap-[0.7cqw] rounded-t-[0.7cqw] px-[1cqw] text-[1.1cqw]",
                          i === tab ? "bg-[#2a2a32] text-white" : "text-white/55 hover:bg-white/5",
                        )}
                      >
                        <span className="size-[1.2cqw] shrink-0 rounded-[0.3cqw]" style={{ background: `rgb(${s.accent})` }} />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                  {/* address bar */}
                  <div className="flex h-[3cqw] shrink-0 items-center gap-[1cqw] bg-[#2a2a32] px-[1.2cqw] text-[1.1cqw] text-white/60">
                    <ChevronLeft className="size-[1.5cqw]" aria-hidden />
                    <ChevronRight className="size-[1.5cqw]" aria-hidden />
                    <RotateCw className="size-[1.2cqw]" aria-hidden />
                    <span className="flex h-[2.1cqw] flex-1 items-center gap-[0.6cqw] rounded-full bg-black/30 px-[1.2cqw]">
                      <Lock className="size-[1cqw]" aria-hidden />
                      {site.url ? (
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="truncate text-white/85 hover:underline">
                          {new URL(site.url).host}
                        </a>
                      ) : (
                        <span className="truncate text-white/85">{site.name}</span>
                      )}
                    </span>
                  </div>
                  {/* the page; key resets the scroll when the tab changes */}
                  <div
                    key={site.name}
                    ref={(el) => {
                      page.current = el;
                      if (el) el.scrollTop = scrolls.current[site.name] ?? 0;
                    }}
                    onScroll={(e) => (scrolls.current[site.name] = e.currentTarget.scrollTop)}
                    tabIndex={0}
                    aria-label={`${site.name} website, scrollable`}
                    className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white [scrollbar-color:rgba(0,0,0,0.3)_transparent] [scrollbar-width:thin] focus-visible:outline-none"
                  >
                    {site.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a very tall screenshot; next/image would only add resize work
                      <img src={site.image} alt={`Full-page screenshot of the ${site.name} website`} decoding="async" width={1440} className="block h-auto w-full" />
                    ) : (
                      <SiteMock accent={site.accent} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* dock */}
            <div className="absolute bottom-[1.2cqw] left-1/2 z-30 flex -translate-x-1/2 items-end gap-[1cqw] rounded-[1.8cqw] bg-white/15 p-[0.8cqw] ring-1 ring-white/20 backdrop-blur-xl">
              {sites.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  data-demo={`dock-${i}`}
                  onClick={() => openSite(i)}
                  aria-label={open && i === tab ? `Minimise ${s.name}` : `Open ${s.name}`}
                  title={s.name}
                  className="group/dock relative flex size-[5.4cqw] items-center justify-center rounded-[1.3cqw] text-[2.6cqw] font-bold shadow-[0_0.6cqw_1.2cqw_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-[0.8cqw] hover:scale-110"
                  style={{ background: `linear-gradient(145deg, rgba(${s.accent},1), rgba(${s.accent},0.6))` }}
                >
                  {s.name[0]}
                  <span className="pointer-events-none absolute -top-[3.2cqw] whitespace-nowrap rounded-[0.5cqw] bg-black/70 px-[0.8cqw] py-[0.3cqw] text-[1.1cqw] font-medium opacity-0 transition-opacity group-hover/dock:opacity-100">
                    {s.name}
                  </span>
                  {open && i === tab && <i className="absolute -bottom-[0.6cqw] size-[0.45cqw] rounded-full bg-white/80" />}
                </button>
              ))}
              <span aria-hidden className="mx-[0.2cqw] h-[4.6cqw] w-px self-center bg-white/25" />
              <button
                type="button"
                onClick={onOpenPhone}
                aria-label="Watch our reels on the phone"
                title="Reels (opens the phone)"
                className="flex size-[5.4cqw] items-center justify-center rounded-[1.3cqw] bg-[linear-gradient(145deg,#ff3d2e,#a35cff)] shadow-[0_0.6cqw_1.2cqw_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-[0.8cqw] hover:scale-110"
              >
                <Clapperboard className="size-[2.6cqw]" aria-hidden />
              </button>
            </div>

            <Ghost pos={ghost} kind="cursor" />
          </div>
        </div>
      </div>
      <LaptopBase />
    </div>
  );
}

// keyboard rows as relative key widths
const keyRows = [
  Array(14).fill(1),
  [...Array(13).fill(1), 1.6],
  [1.5, ...Array(12).fill(1), 1.1],
  [1.8, ...Array(11).fill(1), 1.8],
  [2.3, ...Array(10).fill(1), 2.3],
  [1, 1, 1, 1.3, 5.4, 1.3, 1, 1, 1, 1],
];

/** Keyboard deck sitting on a cooling pad, tilted away from the viewer. Its top edge meets the lid exactly. */
function LaptopBase() {
  return (
    <div aria-hidden className="relative -mb-[11%] [perspective:1600px] [perspective-origin:50%_0%]">
      {/* fan glow under the pad */}
      <div className="absolute inset-x-[10%] top-[18%] h-[22%] rounded-[50%] bg-[#22d3ee]/25 blur-3xl" />
      <div className="relative origin-top [transform-style:preserve-3d] [transform:rotateX(54deg)]">
        {/* cooling pad: mesh top, LED lip on the front */}
        <div
          className="relative rounded-b-[22px] px-[3%] pb-[9%] ring-1 ring-white/[0.07] [transform-style:preserve-3d]"
          style={{
            background: "radial-gradient(rgba(255,255,255,0.09) 1.2px, transparent 1.6px) 0 0 / 11px 11px, linear-gradient(#1b1b21, #131317)",
          }}
        >
          {/* deck */}
          <div className="relative mx-[5%] rounded-b-[16px] bg-[linear-gradient(180deg,#44444f,#30303a)] px-[7%] pb-[5%] pt-[4%] shadow-[0_30px_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.1] [transform-style:preserve-3d]">
            <div className="flex flex-col gap-[0.6%] rounded-md bg-black/30 p-[1.2%]">
              {keyRows.map((row, r) => (
                <div key={r} className={cn("flex gap-[0.6%]", r === 0 ? "h-[clamp(5px,1.1vw,12px)]" : "h-[clamp(8px,1.9vw,20px)]")}>
                  {row.map((w, k) => (
                    <span key={k} className="rounded-[3px] bg-[#0c0c10] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/[0.06]" style={{ flex: w }} />
                  ))}
                </div>
              ))}
            </div>
            <div className="mx-auto mt-[4%] aspect-[16/10] w-[40%] rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08]" />
            {/* deck front edge */}
            <div className="absolute inset-x-0 top-full h-2 origin-top rounded-b-[10px] bg-[#1a1a20] [transform:rotateX(-90deg)]" />
          </div>
          {/* pad front lip */}
          <div className="absolute inset-x-0 top-full flex h-5 origin-top items-center justify-center rounded-b-[14px] bg-[linear-gradient(#202027,#0c0c10)] [transform:rotateX(-54deg)]">
            <span className="h-[2px] w-[40%] rounded-full bg-[#22d3ee] shadow-[0_0_12px_#22d3ee]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stand-in page until a real screenshot is added. Twice the screen height so there is something to scroll. */
function SiteMock({ accent }: { accent: string }) {
  const c = (a: number) => `rgba(${accent},${a})`;
  return (
    <div
      aria-hidden
      className="h-[200%]"
      style={{
        background: `radial-gradient(70% 30% at 70% 8%, ${c(0.35)}, transparent 70%), #0b0b12`,
      }}
    >
      <div className="flex items-center justify-between px-[6%] pt-[4%]">
        <span className="h-2.5 w-16 rounded-full bg-paper/50" />
        <span className="hidden gap-3 sm:flex">
          <span className="h-2 w-10 rounded-full bg-paper/20" />
          <span className="h-2 w-10 rounded-full bg-paper/20" />
          <span className="h-2 w-10 rounded-full bg-paper/20" />
        </span>
        <span className="h-5 w-16 rounded-full" style={{ background: c(0.8) }} />
      </div>
      <div className="px-[6%] pt-[10%]">
        <span className="block h-[clamp(14px,2.4vw,30px)] w-[62%] rounded-md bg-paper/80" />
        <span className="mt-2 block h-[clamp(14px,2.4vw,30px)] w-[44%] rounded-md bg-paper/80" />
        <span className="mt-5 block h-2 w-[38%] rounded-full bg-paper/25" />
        <span className="mt-2 block h-2 w-[30%] rounded-full bg-paper/25" />
        <span className="mt-6 inline-block h-7 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${c(1)}, ${c(0.6)})` }} />
      </div>
      <div className="mt-[12%] grid grid-cols-3 gap-[3%] px-[6%]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="aspect-[4/5] rounded-xl ring-1 ring-white/10"
            style={{
              background: `linear-gradient(160deg, ${c(0.25 - i * 0.06)}, rgba(255,255,255,0.03))`,
            }}
          />
        ))}
      </div>
      <div className="mt-[8%] grid grid-cols-2 items-center gap-[6%] px-[6%]">
        <span
          className="aspect-video rounded-xl"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${c(0.5)}, transparent 70%), rgba(255,255,255,0.04)`,
          }}
        />
        <span>
          <span className="block h-3 w-[80%] rounded bg-paper/60" />
          <span className="mt-3 block h-2 w-full rounded-full bg-paper/20" />
          <span className="mt-2 block h-2 w-[90%] rounded-full bg-paper/20" />
          <span className="mt-2 block h-2 w-[70%] rounded-full bg-paper/20" />
        </span>
      </div>
    </div>
  );
}
