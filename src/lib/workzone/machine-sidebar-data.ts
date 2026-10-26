import { prisma } from "@/lib/db/prisma";

type MachineSidebarRow = {
  id: string;
  name: string;
  category: string;
  nickname: string | null;
  model: string | null;
  targe: string | null;
  vitiProdhimit: number | null;
  vitiBlerjes: number | null;
  tuvDate: Date | null;
  auDate: Date | null;
  huStatus: string | null;
  spDate: Date | null;
  spStatus: string | null;
  uvvDate: Date | null;
  uvvStatus: string | null;
  funksioni: string | null;
  patentaEnevojshme: string | null;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  usageCount: number;
  coneTotal: number;
  coneAvailable: number;
};

const HIDDEN_FLEET_TERMS = [
  "freischneider",
  "motorsäge",
  "motorsägen",
  "motorsaegen",
  "seilwinde",
  "zubehör",
  "zubehoer",
];

function machineSearchText(machine: { name: string; nickname: string | null; model: string | null; funksioni: string | null }) {
  return [machine.name, machine.nickname, machine.model, machine.funksioni].filter(Boolean).join(" ").toLocaleLowerCase("de");
}

function isVisibleFleetMachine(machine: { category: string; name: string; nickname: string | null; model: string | null; funksioni: string | null }) {
  if (machine.category === "CHAINSAW") return false;
  const text = machineSearchText(machine);
  return !HIDDEN_FLEET_TERMS.some((term) => text.includes(term));
}

function fleetSortGroup(machine: { name: string; nickname: string | null; model: string | null; funksioni: string | null; category: string }) {
  const text = machineSearchText(machine);
  if (text.includes("steiger") || text.includes("hubarbeitsbühne") || text.includes("hubarbeitsbuehne")) return 20;
  if (text.includes("sprinter") || text.includes("transporter")) return 30;
  if (text.includes("anhänger") || text.includes("anhaenger")) return 40;
  if (text.includes("häcksler") || text.includes("haecksler") || machine.category === "CHIPPER") return 50;
  if (text.includes("lkw") || text.includes("ladekran") || text.includes("kipper") || text.includes("kran")) return 10;
  if (text.includes("teleskoplader") || text.includes("mobilkran")) return 60;
  return 70;
}

function fleetLabel(machine: { name: string; nickname: string | null }) {
  return machine.nickname ?? machine.name;
}

export async function getMachineSidebarData() {
  const [machinesRaw, coneMovements] = await Promise.all([
    prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        nickname: true,
        model: true,
        targe: true,
        vitiProdhimit: true,
        vitiBlerjes: true,
        tuvDate: true,
        auDate: true,
        huStatus: true,
        spDate: true,
        spStatus: true,
        uvvDate: true,
        uvvStatus: true,
        funksioni: true,
        patentaEnevojshme: true,
        imageUrl: true,
        notes: true,
        isActive: true,
        coneTotal: true,
        _count: { select: { machineItems: true } },
      },
    }),
    prisma.machineConeMovement.findMany({
      select: { type: true, quantity: true, fromMachineId: true, toMachineId: true },
      orderBy: { createdAt: "desc" },
      take: 2500,
    }),
  ]);

  const coneDeltaByMachine = new Map<string, number>();
  for (const movement of coneMovements) {
    const qty = Math.max(0, Number(movement.quantity ?? 0) || 0);
    if (movement.type === "DEPLOY" && movement.fromMachineId) {
      coneDeltaByMachine.set(movement.fromMachineId, (coneDeltaByMachine.get(movement.fromMachineId) ?? 0) - qty);
    } else if (movement.type === "COLLECT" && movement.toMachineId) {
      coneDeltaByMachine.set(movement.toMachineId, (coneDeltaByMachine.get(movement.toMachineId) ?? 0) + qty);
    } else if (movement.type === "TRANSFER") {
      if (movement.fromMachineId) {
        coneDeltaByMachine.set(movement.fromMachineId, (coneDeltaByMachine.get(movement.fromMachineId) ?? 0) - qty);
      }
      if (movement.toMachineId) {
        coneDeltaByMachine.set(movement.toMachineId, (coneDeltaByMachine.get(movement.toMachineId) ?? 0) + qty);
      }
    }
  }

  return machinesRaw
    .map((machine) => {
      const base = Math.max(0, Number((machine as { coneTotal?: number | null }).coneTotal ?? 0) || 0);
      const delta = coneDeltaByMachine.get(machine.id) ?? 0;
      const available = Math.max(0, base + delta);
      return { ...machine, usageCount: machine._count.machineItems, coneTotal: base, coneAvailable: available };
    })
    .filter(isVisibleFleetMachine)
    .sort((a, b) => {
      const groupDiff = fleetSortGroup(a) - fleetSortGroup(b);
      if (groupDiff !== 0) return groupDiff;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return fleetLabel(a).localeCompare(fleetLabel(b), "de", { numeric: true });
    }) satisfies MachineSidebarRow[];
}
