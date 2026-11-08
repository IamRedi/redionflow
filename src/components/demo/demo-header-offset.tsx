"use client";

import { useLayoutEffect, useRef } from "react";

/** Reserves the header's height as initial clearance; the page then scrolls behind the transparent header. */
export function DemoHeaderOffset() {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const header = marker.current?.closest("header");
    const shell = header?.parentElement;
    if (!header || !shell) return;
    const measure = () => shell.style.setProperty("--demo-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => { observer.disconnect(); shell.style.removeProperty("--demo-header-height"); };
  }, []);
  return <span ref={marker} hidden />;
}
