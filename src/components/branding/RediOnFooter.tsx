'use client';
import { cn } from "@/lib/ui/cn";
import localFont from "next/font/local";
import styles from "./RediOnFooter.module.css";

const manrope = localFont({ src: "./fonts/manrope-variable.ttf", weight: "200 800", display: "swap", preload: false, fallback: ["system-ui", "sans-serif"] });
// The author's wordmark keeps its approved spelling in every product language.
const credit = { by: "by", red: "R", green: "e", blue: "d", yellow: "i", on: "ON" };

/** `onDark` is for pages that paint their own dark background regardless of the theme (landing). */
export function RediOnFooter({ onDark = false }: { onDark?: boolean }) {
  return (
    <footer
      className={cn(styles.footer, "print:hidden")}
      data-theme={onDark ? "dark" : undefined}
    >
      <a className={cn(styles.credit, manrope.className)} href="https://www.redioncekrezi.de/" aria-label="by RediON">
        <span aria-hidden="true">{credit.by}</span>
        <span className={styles.name} aria-hidden="true"><span className={styles.red}>{credit.red}</span><span className={styles.green}>{credit.green}</span><span className={styles.blue}>{credit.blue}</span><span className={styles.yellow}>{credit.yellow}</span>{credit.on}</span>
      </a>
    </footer>
  );
}
