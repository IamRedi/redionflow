import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appName, appSuffix } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${appName} ${appSuffix} - Landing`,
  description:
    "BaumdienstFlow ist die operative Plattform fuer Baumdienstbetriebe und verbindet Feldarbeit, Planung und Verwaltung in einem System.",
};

export default function LandingPage() {
  redirect("/");
}
