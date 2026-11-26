// The visitor's own clock, in their language and their 12/24-hour setting.

/** "8:52" or "20:52": like a phone lock screen, no AM/PM. */
export const clockTime = (d: Date) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .formatToParts(d)
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();

/** "Thursday, November 26" in the visitor's language. */
export const clockDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** Menu-bar style: "Thu 8:52 PM" or "Do. 20:52". */
export const clockMenu = (d: Date) => d.toLocaleTimeString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
