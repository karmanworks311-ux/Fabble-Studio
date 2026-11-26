"use client";

import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { Desk } from "./Desk";

export function Work() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      SplitText.create(".work-head", {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.2,
            stagger: 0.1,
            ease: "expo.out",
            scrollTrigger: { trigger: ".work-head", start: "top 82%" },
          }),
      });
      gsap.from(".work-intro", {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".work-intro", start: "top 85%" },
      });
      gsap.fromTo(
        ".work-mark",
        { backgroundSize: "0% 100%" },
        {
          backgroundSize: "100% 100%",
          duration: 1.4,
          delay: 0.4,
          ease: "power2.inOut",
          scrollTrigger: { trigger: ".work-intro", start: "top 75%" },
        },
      );

      gsap.from(".desk", {
        y: 80,
        opacity: 0,
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: { trigger: ".desk", start: "top 85%" },
      });
    },
    { scope: root },
  );

  return (
    <section id="work" ref={root} aria-labelledby="work-title" className="relative isolate pb-16 pt-28 md:pb-24 md:pt-40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(45% 30% at 85% 20%, #22d3ee14, transparent 70%), radial-gradient(40% 30% at 10% 70%, #a35cff14, transparent 70%)",
        }}
      />

      <div className="px-[var(--gutter)]">
        <div className="grid items-end gap-8 md:grid-cols-12">
          <h2 id="work-title" className="work-head display text-[clamp(2.4rem,5.2vw,5.75rem)] md:col-span-8">
            Selected work.
          </h2>
          <p className="work-intro max-w-[30ch] text-xl font-medium leading-snug text-paper md:col-span-4 md:pb-4 md:text-2xl">
            {/* marker swipe: GSAP grows background-size 0%→100% on scroll; stays full when motion is reduced */}
            <span className="work-mark rounded-sm bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-violet)_55%,transparent),color-mix(in_srgb,var(--color-ember-hot)_55%,transparent))] bg-[length:100%_100%] bg-no-repeat px-1 [box-decoration-break:slice]">
              Pick up the phone or the laptop and try them yourself.
            </span>
          </p>
        </div>

      </div>

      {/* full width, no frame: the desk is part of the page */}
      <div className="mt-6 md:mt-10">
        <Desk />
      </div>
    </section>
  );
}
