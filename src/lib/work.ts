// Portfolio content for the Work section. Files live in /public/media/reels.
// Each reel has: reel-N.mp4 (full quality, sound), reel-N-preview.mp4 (8s muted loop), reel-N-poster.jpg.
export const reels = [
  { id: 3, title: "Studio session", kind: "Podcast cut", duration: "0:33" },
  { id: 1, title: "Before and after", kind: "Talking head", duration: "0:51" },
  { id: 2, title: "Creator promo", kind: "Social edit", duration: "0:32" },
  { id: 4, title: "Story with motion", kind: "Motion graphics", duration: "0:38" },
  { id: 5, title: "Local business ad", kind: "Ad creative", duration: "1:25" },
] as const;

export type Reel = (typeof reels)[number];

export const reelSrc = (id: number) => ({
  full: `/media/reels/reel-${id}.mp4`,
  preview: `/media/reels/reel-${id}-preview.mp4`,
  poster: `/media/reels/reel-${id}-poster.jpg`,
});

// Website projects, shown in the laptop on the desk. Each homepage is a screen recording
// (/public/media/sites/<slug>.mp4, made at 1440x900): the intro plays, then scrolling the window scrubs it.
export type SiteVideo = {
  src: string;
  poster: string;
  hold: number; // seconds of intro before the recording starts scrolling
  scrollEnd: number; // second at which it reaches the bottom of the page
  pageHeight: number; // homepage height in px at 1440 wide, so the window scrolls the same distance
};

export type SiteProject = {
  name: string;
  category: string;
  year: string;
  url?: string;
  video?: SiteVideo;
  logo: string;
  logoBg: string; // dock tile behind the logo
  summary: string;
  tags: string[];
  accent: string; // r,g,b
};

const rec = (slug: string, hold: number, scrollEnd: number, pageHeight: number): SiteVideo => ({
  src: `/media/sites/${slug}.mp4`,
  poster: `/media/sites/${slug}.jpg`,
  hold,
  scrollEnd,
  pageHeight,
});

export const sites: SiteProject[] = [
  {
    name: "Noor Estates",
    category: "Real estate website",
    year: "2026",
    video: rec("noor-estates", 2.51, 17.55, 10668),
    logo: "/media/sites/noor-estates-logo.png",
    logoBg: "#26343a",
    summary: "A Dubai brokerage site: property search with filters, live listings, area guides, the team and an enquiry form.",
    tags: ["Design", "Development", "Real estate"],
    accent: "31,77,68",
  },
  {
    name: "Geo Builders",
    category: "Construction company website",
    year: "2026",
    video: rec("geo-builders", 2.5, 17.38, 10554),
    logo: "/media/sites/geo-builders-logo.svg",
    logoBg: "transparent",
    summary: "A site for a Southern Ontario builder: services, before-and-after project stories, a five-step process and a quote request on every page.",
    tags: ["Design", "Development", "Construction"],
    accent: "255,106,44",
  },
  {
    name: "Neel",
    category: "Online store",
    year: "2026",
    video: rec("neel", 2.5, 6.78, 3659),
    logo: "/media/sites/neel-logo.png",
    logoBg: "#ffffff",
    summary: "A cotton tee store with shop-by-fit browsing, search and filters, colour swatches, and UPI, card or netbanking checkout.",
    tags: ["E-commerce", "Design", "Development"],
    accent: "79,93,255",
  },
];
