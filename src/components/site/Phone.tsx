"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BatteryFull,
  Bookmark,
  Camera,
  Clapperboard,
  Flashlight,
  Heart,
  House,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Repeat2,
  Search,
  Send,
  Signal,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from "lucide-react";
import { reels, reelSrc, type Reel } from "@/lib/work";
import { site as studio } from "@/lib/site";
import { toggleMusic, useMusicPlaying } from "@/lib/music";
import { useStored } from "@/lib/useStored";
import { clockDate, clockTime } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { Ghost, useDemo } from "./Ghost";

/** Live clock text, empty until mounted so the server render matches. */
function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * A phone. Asleep it shows a lock screen; awake, tapping the notification opens a reels feed where
 * scrolling snaps reel to reel and only the reel in view plays.
 */
export function PhoneDevice({ awake, demo, onDemoDone }: { awake: boolean; demo: boolean; onDemoDone: () => void }) {
  const screen = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [commentsFor, setCommentsFor] = useState<Reel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const musicOn = useMusicPlaying();
  const now = useClock();

  // putting the phone down locks it again
  useEffect(() => {
    if (awake) return;
    setUnlocked(false);
    setMuted(true);
    setCommentsFor(null);
  }, [awake]);

  // the reel that fills the screen is the active one
  useEffect(() => {
    const root = feed.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-i]").forEach((el) => io.observe(el));

    // one wheel flick = one reel (small wheel deltas would otherwise snap back)
    let lockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.round(root.scrollTop / root.clientHeight) + Math.sign(e.deltaY);
      if (!e.deltaY || next < 0 || next >= reels.length || e.timeStamp < lockedUntil) return;
      lockedUntil = e.timeStamp + 700;
      root.scrollTo({ top: next * root.clientHeight, behavior: "smooth" });
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      io.disconnect();
      root.removeEventListener("wheel", onWheel);
    };
  }, []);

  const ghost = useDemo(
    awake && demo,
    screen,
    async (wait, at, set) => {
      await wait(900);
      set({ x: 50, y: 80 });
      await wait(250);
      set(at('[data-demo="notif"]'));
      await wait(900);
      set({ ...at('[data-demo="notif"]'), down: true });
      await wait(200);
      setUnlocked(true);
      set({ ...at('[data-demo="notif"]'), down: false });
      await wait(1400);
      // swipe up to the next reel, then back
      set({ x: 45, y: 74, down: true });
      await wait(500);
      set({ x: 45, y: 30, down: true });
      feed.current?.scrollTo({ top: feed.current.clientHeight, behavior: "smooth" });
      await wait(900);
      set({ x: 45, y: 30 });
      await wait(400);
      flash("Your turn: swipe, like, comment");
    },
    onDemoDone,
  );

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  // share sends the website: the phone's share sheet where there is one, otherwise the link is copied
  const share = async () => {
    const url = location.origin;
    if (navigator.share) {
      await navigator.share({ title: studio.name, text: "Websites and video editing by Fabble Studio", url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      flash(url);
    }
  };

  const toggleSound = () => {
    if (muted && musicOn) toggleMusic(); // the site music would talk over the reel
    setMuted(!muted);
  };

  return (
    <div className="relative w-[380px]">
      {/* body */}
      <div className="relative rounded-[56px] bg-[#16161c] p-[11px] shadow-[0_0_0_1.5px_rgba(255,255,255,0.14)_inset,0_40px_80px_-30px_rgba(0,0,0,0.9)]">
        <div ref={screen} data-screen className="relative aspect-[9/19.5] overflow-hidden rounded-[46px] bg-black text-white">
          <div inert={!awake || !unlocked} className="absolute inset-0">
            {/* feed */}
            <div
              ref={feed}
              tabIndex={0}
              aria-label="Reels feed, scroll for the next reel"
              className="absolute inset-0 snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
            >
              {reels.map((r, i) => (
                <ReelSlide
                  key={r.id}
                  reel={r}
                  index={i}
                  active={awake && unlocked && i === active}
                  muted={muted}
                  onTap={toggleSound}
                  followed={followed}
                  onFollow={() => setFollowed(true)}
                  onComment={() => setCommentsFor(r)}
                  onShare={share}
                  flash={flash}
                />
              ))}
            </div>

            {/* top bar */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-12 flex items-center justify-between px-4">
              <span className="text-[19px] font-bold tracking-tight">Reels</span>
              <Camera className="size-6" />
            </div>

            {/* bottom nav */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 flex h-[58px] items-start justify-around border-t border-white/10 bg-black pt-2.5">
              <House className="size-6" />
              <Clapperboard className="size-6" strokeWidth={2.4} />
              <Send className="size-6" />
              <Search className="size-6" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/logo-mark.png" alt="" className="size-6 rounded-full bg-white object-contain p-0.5 ring-1 ring-white" />
            </div>

            <AnimatePresence>{commentsFor && <CommentSheet key={commentsFor.id} reel={commentsFor} onClose={() => setCommentsFor(null)} />}</AnimatePresence>
          </div>

          {/* lock screen */}
          <AnimatePresence>
            {!unlocked && (
              <motion.div
                key="lock"
                inert={!awake}
                initial={{ y: 0 }}
                exit={{ y: "-100%", transition: { duration: 0.55, ease: [0.65, 0, 0.35, 1] } }}
                className="absolute inset-0 z-40 flex flex-col items-center"
                style={{ background: `linear-gradient(180deg, rgba(20,8,40,0.35), rgba(0,0,0,0.65)), url(${reelSrc(reels[0].id).poster}) center / cover` }}
              >
                <p className="mt-[72px] text-[15px] font-medium text-white/85">
                  {now && clockDate(now)}
                </p>
                <p className="text-[84px] font-semibold leading-none tracking-tight">
                  {now ? clockTime(now) : " "}
                </p>

                <button
                  type="button"
                  data-demo="notif"
                  onClick={() => setUnlocked(true)}
                  className="mt-auto mb-3 flex w-[88%] items-start gap-3 rounded-[22px] bg-white/20 p-3 text-left ring-1 ring-white/20 backdrop-blur-xl transition-transform active:scale-[0.98]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/media/logo-mark.png" alt="" className="size-10 shrink-0 rounded-[10px] bg-white object-contain p-1.5" />
                  <span className="min-w-0 flex-1 text-[13px] leading-snug">
                    <span className="flex justify-between">
                      <b className="font-semibold">{studio.instagram.handle}</b>
                      <span className="text-white/70">now</span>
                    </span>
                    <span className="block text-white/90">posted a new reel: {reels[0].title}. Tap to watch.</span>
                  </span>
                </button>
                <p className="mb-[86px] animate-pulse text-xs text-white/75">Tap the notification to open</p>

                <div aria-hidden className="absolute inset-x-10 bottom-10 flex justify-between">
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/35 backdrop-blur">
                    <Flashlight className="size-5" />
                  </span>
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/35 backdrop-blur">
                    <Camera className="size-5" />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* status bar + island */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-12 items-center justify-between px-8 text-[14px] font-semibold">
            <span>{now ? clockTime(now) : ""}</span>
            <span className="flex items-center gap-1">
              <Signal className="size-3.5" strokeWidth={2.5} />
              <Wifi className="size-3.5" strokeWidth={2.5} />
              <BatteryFull className="size-5" strokeWidth={2} />
            </span>
          </div>
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-3 z-50 h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
          <span aria-hidden className="pointer-events-none absolute bottom-1.5 left-1/2 z-50 h-1 w-32 -translate-x-1/2 rounded-full bg-white/80" />

          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-[76px] z-50 flex justify-center">
            <AnimatePresence>
              {toast && (
                <motion.span
                  key={toast}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="max-w-[85%] truncate rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black shadow-lg"
                >
                  {toast}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <Ghost pos={ghost} kind="touch" />
        </div>
      </div>
      {/* side buttons */}
      <span aria-hidden className="absolute -left-[3px] top-[18%] h-8 w-[3px] rounded-l bg-[#2a2a33]" />
      <span aria-hidden className="absolute -left-[3px] top-[26%] h-14 w-[3px] rounded-l bg-[#2a2a33]" />
      <span aria-hidden className="absolute -left-[3px] top-[36%] h-14 w-[3px] rounded-l bg-[#2a2a33]" />
      <span aria-hidden className="absolute -right-[3px] top-[28%] h-20 w-[3px] rounded-r bg-[#2a2a33]" />
    </div>
  );
}

function ReelSlide({
  reel,
  index,
  active,
  muted,
  onTap,
  followed,
  onFollow,
  onComment,
  onShare,
  flash,
}: {
  reel: Reel;
  index: number;
  active: boolean;
  muted: boolean;
  onTap: () => void;
  followed: boolean;
  onFollow: () => void;
  onComment: () => void;
  onShare: () => void;
  flash: (msg: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const src = reelSrc(reel.id);
  // kept in this browser so a returning visitor sees what they liked, saved and reposted
  const [liked, setLiked] = useStored(`fabble-reel-${reel.id}-liked`, false);
  const [saved, setSaved] = useStored(`fabble-reel-${reel.id}-saved`, false);
  const [reposted, setReposted] = useStored(`fabble-reel-${reel.id}-reposted`, false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!active) return v.pause();
    if (!v.getAttribute("src")) v.src = src.full; // load only once it is on screen
    v.play().catch(() => {});
  }, [active, src.full]);

  const handle = studio.instagram.handle;
  const rail = "flex flex-col items-center";
  const icon = "size-[26px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]";

  return (
    <section data-i={index} aria-label={`Reel ${index + 1}: ${reel.title}`} className="relative h-full snap-start snap-always">
      <video
        ref={video}
        className="absolute inset-0 size-full object-cover"
        muted={muted}
        loop
        playsInline
        preload="none"
        poster={src.poster}
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={onTap}
        data-cursor="hover"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,transparent_18%,transparent_60%,rgba(0,0,0,0.65)_100%)]"
      >
        <span className="absolute right-4 top-[88px] flex size-7 items-center justify-center rounded-full bg-black/50">
          {muted ? <VolumeX className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
        </span>
      </button>

      {/* action rail */}
      <div className="absolute bottom-[72px] right-2.5 flex flex-col items-center gap-[18px]">
        <button type="button" onClick={() => setLiked(!liked)} aria-pressed={liked} aria-label="Like" className={rail}>
          <Heart className={cn(icon, liked && "fill-[#ff3040] text-[#ff3040]")} />
        </button>
        <button type="button" onClick={onComment} aria-label="Comments" className={rail}>
          <MessageCircle className={cn(icon, "-scale-x-100")} />
        </button>
        <button
          type="button"
          onClick={() => {
            setReposted(!reposted);
            flash(reposted ? "Repost removed" : "Reposted");
          }}
          aria-pressed={reposted}
          aria-label="Repost"
          className={rail}
        >
          <Repeat2 className={cn(icon, reposted && "text-[#3fd17a]")} />
        </button>
        <button type="button" onClick={onShare} aria-label="Share the website" className={rail}>
          <Send className={icon} />
        </button>
        <button
          type="button"
          onClick={() => {
            setSaved(!saved);
            flash(saved ? "Removed from saved" : "Saved");
          }}
          aria-pressed={saved}
          aria-label="Save"
          className={rail}
        >
          <Bookmark className={cn(icon, saved && "fill-white")} />
        </button>
        <MoreHorizontal className={icon} aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src.poster} alt="" className="size-7 rounded-md object-cover ring-2 ring-white" />
      </div>

      {/* caption */}
      <div className="absolute bottom-[68px] left-3.5 right-16 text-[13px] leading-snug">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/logo-mark.png" alt="" className="size-8 rounded-full bg-white object-contain p-1" />
          <a href={studio.instagram.href} target="_blank" rel="noopener noreferrer" className="font-semibold">
            {handle}
          </a>
          <a
            href={studio.instagram.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onFollow}
            className={cn(
              "relative rounded-lg border px-2.5 py-[3px] text-xs font-semibold transition-colors",
              followed ? "border-transparent bg-white/20" : "border-white/60",
            )}
          >
            {!followed && <span aria-hidden className="absolute -inset-1 animate-ping rounded-lg ring-2 ring-[#ff7a2c]/70 [animation-duration:2s]" />}
            {followed ? "Following" : "Follow"}
          </a>
        </div>
        <p className="mt-2 line-clamp-2">
          {reel.title} <span className="text-white/75">· {reel.kind}</span>
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <Music2 className="size-3" aria-hidden />
          <span className="truncate">{handle} · Original audio</span>
        </p>
      </div>
    </section>
  );
}

type Comment = { text: string; at: number };

/** Comments sheet that slides up over the reel. shortcut: comments stay in this visitor's browser; add a backend to share them with everyone. */
function CommentSheet({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const [comments, setComments] = useStored<Comment[]>(`fabble-reel-${reel.id}-comments`, []);
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const post = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setComments([...comments, { text, at: Date.now() }]);
    setDraft("");
    requestAnimationFrame(() =>
      list.current?.scrollTo({
        top: list.current.scrollHeight,
        behavior: "smooth",
      }),
    );
  };

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close comments"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-20 bg-black/40"
      />
      <motion.div
        role="dialog"
        aria-label={`Comments on ${reel.title}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="absolute inset-x-0 bottom-0 z-30 flex h-[64%] flex-col rounded-t-2xl bg-[#25252a] pb-6"
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/30" />
        <div className="relative flex items-center justify-center py-2.5">
          <span className="text-sm font-semibold">Comments</span>
          <button type="button" onClick={onClose} aria-label="Close comments" className="absolute right-3 p-1">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <span aria-hidden className="h-px bg-white/10" />

        <ul ref={list} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:none]">
          {comments.length === 0 ? (
            <li className="pt-10 text-center">
              <p className="text-lg font-bold">No comments yet</p>
              <p className="mt-1 text-xs text-white/60">Start the conversation.</p>
            </li>
          ) : (
            comments.map((c) => (
              <li key={c.at} className="flex gap-2.5 text-[13px]">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a2c] to-[#a35cff] text-xs font-bold"
                >
                  Y
                </span>
                <span className="min-w-0">
                  <span className="text-xs font-semibold">you</span> <span className="text-xs text-white/50">{ago(c.at)}</span>
                  <span className="block break-words">{c.text}</span>
                </span>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={post} className="flex items-center gap-2 border-t border-white/10 px-3 pt-2.5">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a2c] to-[#a35cff] text-xs font-bold"
          >
            Y
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            autoFocus
            aria-label="Add a comment"
            placeholder={`Add a comment for ${studio.instagram.handle}...`}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/45"
          />
          <button type="submit" disabled={!draft.trim()} className="text-[13px] font-semibold text-[#4a9dff] disabled:opacity-40">
            Post
          </button>
        </form>
      </motion.div>
    </>
  );
}

const ago = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};
