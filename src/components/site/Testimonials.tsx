"use client";

import { useCallback, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { testimonials, type Testimonial } from "@/lib/testimonials";

const tone = {
  Website: { text: "var(--tone-web)", rgb: "163,92,255" },
  Video: { text: "var(--tone-video)", rgb: "34,211,238" },
} as const;

/**
 * One review at a time, no cards: the quote sits in a soft spotlight tinted by the kind of
 * project, its key phrase gets the highlighter swipe, and arrows, arrow keys or a swipe
 * slide to the next. All quotes share one grid cell, so the section keeps the height of the
 * longest and nothing below jumps when it changes.
 */
export function Testimonials() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();
  const n = testimonials.length;
  const go = useCallback(
    (d: number) => {
      setDir(d);
      setActive((a) => (a + d + n) % n);
    },
    [n],
  );

  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      SplitText.create(".tst-head", {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.2,
            stagger: 0.1,
            ease: "expo.out",
            scrollTrigger: { trigger: ".tst-head", start: "top 82%" },
          }),
      });
      gsap.from(".tst-fade", { y: 30, opacity: 0, duration: 1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: ".tst-head", start: "top 82%" } });
    },
    { scope: root },
  );

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  const arrow =
    "flex size-12 items-center justify-center rounded-full bg-white/[0.06] text-paper ring-1 ring-inset ring-white/10 backdrop-blur-md transition-colors duration-300 hover:bg-paper hover:text-ink";
  const t = testimonials[active];

  return (
    <section id="testimonials" ref={root} aria-labelledby="testimonials-title" className="relative isolate overflow-x-clip px-[var(--gutter)] py-28 md:py-40">
      {/* the spotlight, tinted by the kind of project on show */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-700"
        style={{ background: `radial-gradient(45% 45% at 50% 62%, rgba(${tone[t.service].rgb},0.14), transparent 70%)` }}
      />

      <div className="grid items-end gap-8 md:grid-cols-12">
        <h2 id="testimonials-title" className="tst-head display text-[clamp(2.4rem,5.2vw,5.75rem)] md:col-span-7">
          Kind words.
        </h2>
        <p className="tst-fade max-w-[38ch] text-lg leading-relaxed text-mist md:col-span-5 md:justify-self-end md:pb-4 md:text-right">
          What clients say once the site is live or the video is out, in their own words.
        </p>
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Client testimonials"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        className="tst-fade mx-auto mt-16 max-w-3xl focus-visible:outline-none md:mt-24"
      >
        <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} onDragEnd={onDragEnd} className="grid cursor-grab active:cursor-grabbing">
          {/* invisible copies of every quote hold the height of the longest, so nothing below jumps */}
          {testimonials.map((q) => (
            <div key={q.name} aria-hidden className="invisible [grid-area:1/1]">
              <Quote t={q} reduce />
            </div>
          ))}
          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={active}
              custom={dir}
              className="[grid-area:1/1] self-center"
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 48 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -48 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Quote t={t} reduce={!!reduce} />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="mt-12 flex items-center justify-center gap-6">
          <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial" data-cursor="hover" className={arrow}>
            <ChevronLeft className="size-5" />
          </button>
          <p aria-hidden className="min-w-[5.5ch] text-center font-mono text-xs tracking-[0.2em] text-mist">
            <span className="text-paper">{String(active + 1).padStart(2, "0")}</span> / {String(n).padStart(2, "0")}
          </p>
          <button type="button" onClick={() => go(1)} aria-label="Next testimonial" data-cursor="hover" className={arrow}>
            <ChevronRight className="size-5" />
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {`Testimonial ${active + 1} of ${n}: ${t.quote} — ${[t.name, t.role, t.company].filter(Boolean).join(", ")}`}
        </p>
      </div>
    </section>
  );
}

function Quote({ t, reduce }: { t: Testimonial; reduce: boolean }) {
  const tn = tone[t.service];
  const at = t.highlight ? t.quote.indexOf(t.highlight) : -1;
  const [before, mark, after] = at < 0 ? [t.quote, "", ""] : [t.quote.slice(0, at), t.highlight!, t.quote.slice(at + t.highlight!.length)];

  return (
    <figure className="select-none text-center">
      <blockquote className="text-[clamp(1.35rem,2.4vw,2.1rem)] font-medium leading-[1.4] text-paper">
        {before}
        {mark && (
          // the swipe plays each time this quote slides in
          <motion.span
            className="rounded-sm bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-violet)_55%,transparent),color-mix(in_srgb,var(--color-ember-hot)_55%,transparent))] bg-no-repeat -mx-1 px-1 [box-decoration-break:slice]"
            initial={{ backgroundSize: reduce ? "100% 100%" : "0% 100%" }}
            animate={{ backgroundSize: "100% 100%" }}
            transition={{ duration: 1, delay: 0.3, ease: "easeInOut" }}
          >
            {mark}
          </motion.span>
        )}
        {after}
      </blockquote>
      <figcaption className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm md:text-base">
        {t.avatar && (
          // eslint-disable-next-line @next/next/no-img-element -- tiny optional client photo
          <img src={t.avatar} alt="" className="size-8 rounded-full object-cover ring-1 ring-white/15" />
        )}
        <span className="font-medium text-paper">{t.name}</span>
        {(t.role || t.company) && <span className="text-mist">{[t.role, t.company].filter(Boolean).join(" · ")}</span>}
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-white/15" style={{ color: tn.text }}>
          {t.service}
        </span>
        {t.sample && <span className="rounded-full bg-ember/15 px-2.5 py-0.5 text-xs font-medium text-ember-hot ring-1 ring-ember/30">Sample</span>}
      </figcaption>
    </figure>
  );
}
