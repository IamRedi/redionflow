import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoThemeButton({ dark, label }: { dark: boolean; label: string }) {
  return <form action="/app/toggle-theme" method="post"><Button type="submit" variant="outline" size="icon" className="size-11 rounded-full" aria-label={label} title={label}>{dark ? <Sun /> : <Moon />}</Button></form>;
}
