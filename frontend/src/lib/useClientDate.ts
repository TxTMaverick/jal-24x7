"use client";

import { useEffect, useState } from "react";

/** Local calendar date, `offsetDays` from today, as `YYYY-MM-DD`. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * A date that is only computed in the browser.
 *
 * Calling `new Date()` while rendering breaks hydration here. These pages are
 * statically prerendered, so the date is resolved once when the project is
 * built and baked into the HTML: from the next day onwards the server markup
 * carries the build date while the browser computes today, the `value` and
 * `min` attributes disagree, and React reports a hydration mismatch.
 *
 * Returning an empty string until after mount keeps the server and the first
 * client render identical, which is the rule hydration actually cares about.
 * The real date lands immediately afterwards, so the input is only briefly
 * blank and never wrong.
 */
export function useClientDate(offsetDays = 0): string {
  const [value, setValue] = useState("");
  useEffect(() => setValue(isoDate(offsetDays)), [offsetDays]);
  return value;
}
