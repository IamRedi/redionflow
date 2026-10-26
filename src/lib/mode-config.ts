export type CompanyMode = "baumdienst" | "bau";

export interface ModeFeatures {
  /** Tree-specific modules: BaumKalk, TreeItem management, site tree scanning */
  trees: boolean;
  /** Machines, fleet, cone tracking */
  machines: boolean;
  /** Reporting module */
  reports: boolean;
  /** Baustelle management and workzone */
  baustellen: boolean;
  /** Cost calculation engine: Projekte, Vorlagen, Lohnrollen */
  calculation: boolean;
  /** Barcode / NFC inventory system */
  inventory: boolean;
  /** Fleet GPS and worker phone GPS */
  gps: boolean;
}

export const modeConfig: Record<CompanyMode, ModeFeatures> = {
  baumdienst: {
    trees: true,
    machines: true,
    reports: true,
    baustellen: true,
    calculation: true,
    inventory: true,
    gps: true,
  },
  bau: {
    trees: false,
    machines: true,
    reports: true,
    baustellen: true,
    calculation: true,
    inventory: true,
    gps: true,
  },
};

export function resolveMode(raw: string | null | undefined): CompanyMode {
  if (raw === "bau") return raw;
  return "baumdienst";
}

export function getFeatures(mode: CompanyMode): ModeFeatures {
  return modeConfig[mode];
}

export interface ProductBranding {
  name: string;
  suffix: string;
  superscript: string;
  /** Full display string, e.g. "BaumdienstFlow²⁶" */
  full: string;
}

export function productBranding(mode: CompanyMode): ProductBranding {
  switch (mode) {
    case "bau":
      return { name: "Bau", suffix: "Flow", superscript: "26", full: "BauFlow²⁶" };
    default:
      return { name: "Baumdienst", suffix: "Flow", superscript: "26", full: "BaumdienstFlow²⁶" };
  }
}
