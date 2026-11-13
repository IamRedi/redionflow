"use client";

import { addTransitionType, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keep the existing HttpOnly cookie/POST, including no-JS. Refresh merges the
 * server theme without discarding open forms, drafts or list position. */
export function DemoThemeButton({ label, errorLabel }: { label: string; errorLabel: string }) {
  const router = useRouter(), inFlight = useRef(false);
  const [posting, setPosting] = useState(false), [failed, setFailed] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || refreshing) return;
    inFlight.current = true; setPosting(true); setFailed(false);
    let animate = false;
    try {
      // Apply Set-Cookie without downloading a redirected full HTML page.
      const response = await fetch("/app/toggle-theme", { method: "POST", credentials: "same-origin", redirect: "manual", cache: "no-store" });
      if (response.type !== "opaqueredirect" && !response.ok) throw new Error("theme_request_failed");
      animate = true;
    } catch {
      // A lost response may already have applied the cookie. Read back rather
      // than repeating the POST and accidentally toggling twice.
      setFailed(true);
    } finally {
      startRefresh(() => { if (animate) addTransitionType("baum-theme"); router.refresh(); });
      inFlight.current = false; setPosting(false);
    }
  }
  return <form action="/app/toggle-theme" method="post" onSubmit={submit} className="relative">
    <Button type="submit" variant="outline" size="icon" className="size-11 rounded-full" aria-label={label} title={label} disabled={posting || refreshing} aria-busy={posting || refreshing}><Sun className="hidden dark:block" aria-hidden="true" /><Moon className="dark:hidden" aria-hidden="true" /></Button>
    {failed && <span role="alert" className="absolute right-0 top-full z-50 mt-1 w-max max-w-64 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground">{errorLabel}</span>}
  </form>;
}
