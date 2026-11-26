"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Where the demo pointer is, in % of the screen it plays on. */
export type GhostPos = { x: number; y: number; down?: boolean };

/** The demo pointer: a touch dot on the phone, an arrow cursor on the laptop. */
export function Ghost({ pos, kind }: { pos: GhostPos | null; kind: "touch" | "cursor" }) {
  return (
    <AnimatePresence>
      {pos && (
        <motion.div
          key="ghost"
          aria-hidden
          className="pointer-events-none absolute z-[70]"
          initial={{ opacity: 0, left: `${pos.x}%`, top: `${pos.y}%` }}
          animate={{ opacity: 1, left: `${pos.x}%`, top: `${pos.y}%`, scale: pos.down ? 0.8 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.65, 0, 0.35, 1], scale: { duration: 0.15 } }}
        >
          {kind === "touch" ? (
            <span className="block size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 ring-2 ring-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.4)]" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-[2.2cqw] min-h-4 min-w-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              <path d="M4 2.5v17.2l4.6-4.4 3 6.8 3-1.3-3-6.7h6.4L4 2.5Z" fill="white" stroke="black" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          )}
          {pos.down && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute left-0 top-0 block size-8 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Runs a one-time demo while `run` is true. The script gets `wait` (throws once cancelled) and `at`
 * (an element's centre, in % of `screen`). Any real pointer press inside `screen` stops it.
 */
export function useDemo(
  run: boolean,
  screen: React.RefObject<HTMLElement | null>,
  script: (wait: (ms: number) => Promise<void>, at: (selector: string) => GhostPos, set: (p: GhostPos | null) => void) => Promise<void>,
  onDone: () => void,
) {
  const [pos, setPos] = useState<GhostPos | null>(null);
  const latest = useRef({ script, onDone });
  latest.current = { script, onDone };

  useEffect(() => {
    const el = screen.current;
    if (!run || !el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dead = false;
    const stop = () => {
      if (dead) return;
      dead = true;
      setPos(null);
      latest.current.onDone();
    };
    const wait = (ms: number) => new Promise<void>((ok, fail) => setTimeout(() => (dead ? fail() : ok()), ms));
    const at = (selector: string): GhostPos => {
      const s = el.getBoundingClientRect();
      const t = el.querySelector(selector)?.getBoundingClientRect();
      if (!t) return { x: 50, y: 50 };
      return { x: ((t.left + t.width / 2 - s.left) / s.width) * 100, y: ((t.top + t.height / 2 - s.top) / s.height) * 100 };
    };
    const set = (p: GhostPos | null) => !dead && setPos(p);

    el.addEventListener("pointerdown", stop);
    latest.current
      .script(wait, at, set)
      .then(stop)
      .catch(() => {});
    return () => {
      el.removeEventListener("pointerdown", stop);
      dead = true;
      setPos(null);
    };
  }, [run, screen]);

  return pos;
}
