"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

function detectLandingTheme() {
  if (typeof document === "undefined") return "light" as const;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function HeroPreview({
  badge: _badge,
  title,
  subtitle: _subtitle,
  footer: _footer,
  initialTheme,
  ctaLabel,
  fieldTestLabel,
  demoEnabled,
}: {
  badge: string;
  title: string;
  subtitle: string;
  footer: string;
  initialTheme: "light" | "dark";
  ctaLabel: string;
  fieldTestLabel: string;
  demoEnabled: boolean;
}) {
  const [mode, setMode] = useState<"light" | "dark">(initialTheme);
  const screenshot = mode === "dark" ? "/landingpagephoto/workzoneliveDark.png" : "/landingpagephoto/workzoneliveLight.png";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncMode = () => setMode(detectLandingTheme());
    syncMode();

    const observer = new MutationObserver(syncMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <div className="group relative mx-auto w-full rounded-xl border border-white/10 bg-white/[0.045] p-2.5 shadow-[0_22px_50px_rgba(0,0,0,0.2)] transition duration-300 hover:shadow-[0_30px_70px_rgba(16,185,129,0.1)] sm:max-w-[76%] sm:p-3.5">
        <div className="rounded-lg border border-white/8 bg-[#10211a] p-3 sm:p-4">
          <div className="overflow-hidden rounded-lg border border-white/8 bg-[#13281f]">
            <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/14" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              <div className="h-6 w-28 rounded-full border border-white/8 bg-white/6" />
            </div>

            <div className="relative aspect-[16/10] overflow-hidden">
              <Image src={screenshot} alt={title} fill priority sizes="(min-width: 640px) 58vw, 100vw" className="object-cover transition duration-300 group-hover:scale-[1.015]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,10,0.03),rgba(8,12,10,0.22))]" />

              <div className="relative flex h-full items-end justify-center p-6 text-center transition hover:bg-black/5">
                <div className="flex flex-col items-center gap-2">
                  {demoEnabled ? (
                    <Link href="/demo/workzone" className="inline-flex min-w-40 justify-center rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
                      {ctaLabel}
                    </Link>
                  ) : null}
                  <Link href="/zugang" className="inline-flex min-w-40 justify-center rounded-full border border-white/18 bg-black/55 px-5 py-2.5 text-sm font-semibold text-white/88 backdrop-blur transition hover:bg-black/70 hover:text-white">
                    {fieldTestLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none mx-auto mt-3 h-4 w-[44%] rounded-full border border-white/8 bg-white/[0.05] shadow-[0_10px_22px_rgba(0,0,0,0.16)]" />
      </div>
    </div>
  );
}
