type MachineLabel = { name: string; nickname?: string | null; targe?: string | null };
export function planMachineName(machine: MachineLabel) {
  return (machine.nickname?.trim() || machine.name.trim()).split(/\s+/)[0] || machine.name;
}
export function planMachineLabel(machine: MachineLabel) {
  return [planMachineName(machine), machine.targe?.trim()].filter(Boolean).join(' · ');
}
