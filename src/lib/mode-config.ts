export type CompanyMode = "baumdienst" | "bau" | "personal";

export interface ModeFeatures {
  /** Tree-specific modules: BaumKalk, TreeItem management, site tree scanning */
  trees: boolean;
  /** Machines, fleet, cone tracking */
  machines: boolean;
  /** Full reports (true) or limited summary only ("limited") */
  reports: boolean | "limited";
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
  personal: {
    trees: false,
    machines: false,
    reports: "limited",
    baustellen: false,
    calculation: false,
    inventory: false,
    gps: false,
  },
};

export function resolveMode(raw: string | null | undefined): CompanyMode {
  if (raw === "bau" || raw === "personal") return raw;
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
    case "personal":
      return { name: "Personal", suffix: "Flow", superscript: "26", full: "PersonalFlow²⁶" };
    default:
      return { name: "Baumdienst", suffix: "Flow", superscript: "26", full: "BaumdienstFlow²⁶" };
  }
}
