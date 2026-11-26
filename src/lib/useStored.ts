"use client";

import { useEffect, useState } from "react";

/** useState that also lives in localStorage. Read after mount so the server render and first paint match. */
export function useStored<T>(key: string, init: T) {
  const [value, setValue] = useState(init);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw));
    } catch {}
  }, [key]);
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [value, set] as const;
}
