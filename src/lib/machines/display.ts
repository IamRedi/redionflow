export type MachineCategoryCode = "CHIPPER" | "TRUCK" | "AWP" | "CHAINSAW" | "OTHER";

export type MachineListOption = {
  id: string;
  name: string;
  category?: MachineCategoryCode | null;
  nickname?: string | null;
  model?: string | null;
  targe?: string | null;
  funksioni?: string | null;
  isActive?: boolean | null;
};

export const MACHINE_CATEGORY_OPTIONS: Array<{ value: MachineCategoryCode; label: string }> = [
  { value: "TRUCK", label: "Fahrzeuge / Transporter" },
  { value: "AWP", label: "Hubsteiger / Arbeitsbuehne" },
  { value: "CHIPPER", label: "Haechsler" },
  { value: "CHAINSAW", label: "Motorsaegen / Kleingeraete" },
  { value: "OTHER", label: "Sonstige Maschinen" },
];

export function machineCategoryLabel(category?: MachineCategoryCode | null) {
  return MACHINE_CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? "Sonstige Maschinen";
}

/**
 * Prefer the machine's nickname, then its name, then a neutral placeholder.
 * The "Machine" fallback is only reached when both fields are empty in the
 * database and is a machine-record label, not a user-facing sentence, so a
 * language-neutral English placeholder keeps the code simple.
 */
export function machineDisplayName(machine: MachineListOption) {
  return (machine.nickname || machine.name || "—").trim();
}

export function machineSecondaryLabel(machine: MachineListOption) {
  return [machine.targe, machine.model, machine.funksioni].map((item) => item?.trim()).filter(Boolean).join(" · ");
}

export function machineOptionLabel(machine: MachineListOption) {
  const secondary = machineSecondaryLabel(machine);
  return secondary ? `${machineDisplayName(machine)} (${secondary})` : machineDisplayName(machine);
}

export function machineSearchText(machine: MachineListOption) {
  return [
    machine.name,
    machine.nickname,
    machine.model,
    machine.targe,
    machine.funksioni,
    machine.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function machineOptionsForField(
  machines: MachineListOption[],
  category: MachineCategoryCode,
  fallbackPattern: RegExp,
) {
  const preferred = machines.filter((machine) => machine.category === category || fallbackPattern.test(machineSearchText(machine)));
  return preferred.length > 0 ? preferred : machines;
}
