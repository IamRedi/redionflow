/** HR tools: worker profiles, vacation, availability and daily-plan checks. */

import { prisma } from "@/lib/db/prisma";
import type { RequesterContext } from "../requester";
import { assistantToolText } from "./text";
import {
  startOfLocalDay,
  todayKey,
  endOfLocalDay,
  dateKeyFromDate,
  normalizeName,
  workerByNameFilter,
} from "./shared";

export async function getWorkerHrProfile(
  requester: RequesterContext,
  input: { workerName: string },
): Promise<
  | {
      ok: true;
      worker: string;
      licenses: string | null;
      position: string | null;
      level: string;
      availability: string;
      phone: string | null;
      emailAccount: string | null;
      birthDate: string | null;
      startedAtCompany: string | null;
      assetItems: Array<{ kind: string; itemName: string; itemCode: string | null }>;
      message: string;
    }
  | { ok: false; message: string }
> {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") {
    return { ok: false, message: text.hrAdminOnly };
  }

  const worker = await prisma.worker.findFirst({
    where: workerByNameFilter(requester.companyId, input.workerName),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      licenses: true,
      position: true,
      level: true,
      availability: true,
      phone: true,
      emailAccount: true,
      birthDate: true,
      startedAtCompany: true,
    },
  });
  if (!worker) return { ok: false, message: text.workerNotFound };

  const assets = await prisma.workerAssetItem.findMany({
    where: { workerId: worker.id, status: "ACTIVE" },
    select: { kind: true, itemName: true, itemCode: true },
    orderBy: { handedOverAt: "desc" },
    take: 40,
  });

  const label = `${worker.firstName} ${worker.lastName}`.trim();
  const lic = worker.licenses?.trim() ?? null;
  const message = lic
    ? text.profileLicenses(lic)
    : text.noLicenses;

  return {
    ok: true,
    worker: label,
    licenses: lic,
    position: worker.position,
    level: worker.level,
    availability: worker.availability,
    phone: worker.phone,
    emailAccount: worker.emailAccount,
    birthDate: worker.birthDate ? worker.birthDate.toISOString().slice(0, 10) : null,
    startedAtCompany: worker.startedAtCompany ? worker.startedAtCompany.toISOString().slice(0, 10) : null,
    assetItems: assets.map((a) => ({ kind: a.kind, itemName: a.itemName, itemCode: a.itemCode })),
    message,
  };
}

function availabilityReason(availability: string, hasApprovedVacation: boolean, text = assistantToolText("DE")) {
  if (hasApprovedVacation) return text.approvedVacation;
  if (availability === "VACATION") return text.vacationProfileStatus;
  if (availability === "SICK") return text.sick;
  if (availability === "UNAVAILABLE") return text.unavailable;
  return null;
}

function licenseTokenSet(value: string | null | undefined) {
  return new Set(
    (value ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function analyzePlanLicenseWarnings(
  workers: Array<{ name: string; licenses: string | null }>,
  machines: Array<{ name: string; requiredLicense: string | null }>,
  text = assistantToolText("DE"),
) {
  const requirements = new Map<string, string[]>();
  for (const machine of machines) {
    for (const token of licenseTokenSet(machine.requiredLicense)) {
      requirements.set(token, [...(requirements.get(token) ?? []), machine.name]);
    }
  }

  const warnings: string[] = [];
  for (const [token, machineNames] of requirements) {
    const capable = workers.filter((worker) => licenseTokenSet(worker.licenses).has(token));
    if (capable.length === 0) {
      warnings.push(text.licenseMissing(token, machineNames.join(", ")));
    } else if (machineNames.length > capable.length) {
      warnings.push(text.licenseShortage(machineNames.length, token, capable.length));
    }
  }
  return warnings;
}

export async function getMyVacationSummary(requester: RequesterContext) {
  const text = assistantToolText(requester);
  if (requester.kind === "anonymous") return { ok: false as const, message: text.notSignedIn };
  if (requester.kind !== "worker") return { ok: false as const, message: text.vacationAdminHint };

  const worker = await prisma.worker.findUnique({
    where: { id: requester.workerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      vacationAllowanceDays: true,
      vacationRequests: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          requestedDays: true,
          status: true,
          workerNote: true,
          adminMessage: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!worker) return { ok: false as const, message: text.workerNotFound };

  const approvedDays = worker.vacationRequests.filter((request) => request.status === "APPROVED").reduce((sum, request) => sum + request.requestedDays, 0);
  const pendingDays = worker.vacationRequests.filter((request) => request.status === "PENDING").reduce((sum, request) => sum + request.requestedDays, 0);
  const remainingDays = Math.max(0, worker.vacationAllowanceDays - approvedDays);

  return {
    ok: true as const,
    worker: `${worker.firstName} ${worker.lastName}`.trim(),
    allowanceDays: worker.vacationAllowanceDays,
    approvedDays,
    pendingDays,
    remainingDays,
    requests: worker.vacationRequests.map((request) => ({
      id: request.id,
      startDate: dateKeyFromDate(request.startDate),
      endDate: dateKeyFromDate(request.endDate),
      requestedDays: request.requestedDays,
      status: request.status,
      workerNote: request.workerNote,
      adminMessage: request.adminMessage,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
    })),
    message: text.vacationSummary(worker.vacationAllowanceDays, approvedDays, pendingDays, remainingDays),
  };
}

export async function adminListVacationRequests(
  requester: RequesterContext,
  input: { status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; date?: string; limit?: number },
) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const status = input.status ?? "PENDING";
  const take = Math.min(100, Math.max(1, Math.floor(Number(input.limit ?? 50) || 50)));
  const day = input.date ? startOfLocalDay(input.date) : null;
  if (input.date && !day) return { ok: false as const, message: text.invalidDate };

  const rows = await prisma.vacationRequest.findMany({
    where: {
      companyProfileId: requester.companyId,
      ...(status === "ALL" ? {} : { status }),
      ...(day ? { startDate: { lte: endOfLocalDay(day) }, endDate: { gte: day } } : {}),
    },
    orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      worker: { select: { id: true, firstName: true, lastName: true } },
      reviewedByAdmin: { select: { name: true, email: true } },
    },
  });

  return {
    ok: true as const,
    status,
    date: input.date ?? null,
    count: rows.length,
    requests: rows.map((request) => ({
      id: request.id,
      worker: `${request.worker.firstName} ${request.worker.lastName}`.trim(),
      startDate: dateKeyFromDate(request.startDate),
      endDate: dateKeyFromDate(request.endDate),
      requestedDays: request.requestedDays,
      status: request.status,
      workerNote: request.workerNote,
      adminMessage: request.adminMessage,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      reviewedBy: request.reviewedByAdmin?.name ?? request.reviewedByAdmin?.email ?? null,
      createdAt: request.createdAt.toISOString(),
    })),
    message:
      rows.length === 0
        ? text.noVacationRequests
        : text.vacationRequestsFound(rows.length, status),
  };
}

export async function adminGetAvailabilityForDate(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false as const, message: text.invalidDate };
  const dayEnd = endOfLocalDay(day);

  const workers = await prisma.worker.findMany({
    where: { companyProfileId: requester.companyId, status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      availability: true,
      vacationRequests: {
        where: {
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { lte: dayEnd },
          endDate: { gte: day },
        },
        select: { id: true, status: true, startDate: true, endDate: true, requestedDays: true },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const available: Array<{ worker: string }> = [];
  const unavailable: Array<{ worker: string; reason: string; vacation?: { startDate: string; endDate: string; requestedDays: number } }> = [];
  const pendingVacation: Array<{ worker: string; startDate: string; endDate: string; requestedDays: number }> = [];

  for (const worker of workers) {
    const label = `${worker.firstName} ${worker.lastName}`.trim();
    const approved = worker.vacationRequests.find((request) => request.status === "APPROVED");
    const pending = worker.vacationRequests.filter((request) => request.status === "PENDING");
    for (const request of pending) {
      pendingVacation.push({
        worker: label,
        startDate: dateKeyFromDate(request.startDate),
        endDate: dateKeyFromDate(request.endDate),
        requestedDays: request.requestedDays,
      });
    }

    const reason = availabilityReason(worker.availability, Boolean(approved), text);
    if (reason) {
      unavailable.push({
        worker: label,
        reason,
        vacation: approved
          ? {
              startDate: dateKeyFromDate(approved.startDate),
              endDate: dateKeyFromDate(approved.endDate),
              requestedDays: approved.requestedDays,
            }
          : undefined,
      });
    } else {
      available.push({ worker: label });
    }
  }

  return {
    ok: true as const,
    date: key,
    availableCount: available.length,
    unavailableCount: unavailable.length,
    pendingVacationCount: pendingVacation.length,
    available,
    unavailable,
    pendingVacation,
    message: text.availabilitySummary(available.length, unavailable.length, key, pendingVacation.length),
  };
}

export async function adminAnalyzeDailyPlanLicenses(requester: RequesterContext, input: { date?: string }) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false as const, message: text.invalidDate };

  const plan = await prisma.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: requester.companyId, planDate: day } },
    include: {
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          baustelle: { select: { name: true } },
          assignments: {
            orderBy: { sortOrder: "asc" },
            include: {
              worker: { select: { firstName: true, lastName: true, licenses: true } },
              machine: { select: { name: true, nickname: true, patentaEnevojshme: true, isActive: true, targe: true, model: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) return { ok: true as const, date: key, groups: [], warnings: [], message: text.noDailyPlan(key) };

  const groups = plan.columns.map((column) => {
    const workers = column.assignments
      .filter((assignment) => assignment.kind === "WORKER" && assignment.worker)
      .map((assignment) => ({
        name: `${assignment.worker!.firstName} ${assignment.worker!.lastName}`.trim(),
        licenses: assignment.worker!.licenses,
      }));
    const machines = column.assignments
      .filter((assignment) => assignment.kind === "MACHINE" && assignment.machine)
      .map((assignment) => ({
        name: assignment.machine!.nickname ?? assignment.machine!.name,
        requiredLicense: assignment.machine!.patentaEnevojshme,
        plate: assignment.machine!.targe,
        model: assignment.machine!.model,
        active: assignment.machine!.isActive,
      }));
    return {
      baustelle: column.baustelle?.name ?? column.title,
      workers,
      machines,
      warnings: analyzePlanLicenseWarnings(workers, machines, text),
    };
  });

  const warnings = groups.flatMap((group) => group.warnings.map((warning) => `${group.baustelle}: ${warning}`));

  return {
    ok: true as const,
    date: key,
    groups,
    warnings,
    message: warnings.length === 0 ? text.dailyPlanLicensesOk(key) : text.dailyPlanLicenseWarnings(key, warnings.length),
  };
}

export async function adminQueryDailyPlan(
  requester: RequesterContext,
  input: { date?: string; workerName?: string; baustelleName?: string },
) {
  const text = assistantToolText(requester);
  if (requester.kind !== "admin") return { ok: false as const, message: text.adminOnly };

  const key = (input.date ?? todayKey()).trim();
  const day = startOfLocalDay(key);
  if (!day) return { ok: false as const, message: text.invalidDate };
  const workerNeedle = normalizeName(input.workerName ?? "").toLowerCase();
  const baustelleNeedle = normalizeName(input.baustelleName ?? "").toLowerCase();

  const plan = await prisma.dailyWorkPlan.findUnique({
    where: { companyProfileId_planDate: { companyProfileId: requester.companyId, planDate: day } },
    include: {
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          baustelle: { select: { name: true } },
          assignments: {
            orderBy: { sortOrder: "asc" },
            include: {
              worker: { select: { firstName: true, lastName: true, licenses: true } },
              machine: { select: { name: true, nickname: true, patentaEnevojshme: true, targe: true, model: true, isActive: true } },
            },
          },
        },
      },
      savedRows: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!plan) return { ok: true as const, date: key, groups: [], message: text.noDailyPlan(key) };

  const liveGroups = plan.columns.map((column) => {
    const workers = column.assignments
      .filter((assignment) => assignment.kind === "WORKER")
      .map((assignment) => {
        const label = assignment.worker ? `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim() : assignment.labelSnapshot;
        return { name: label, licenses: assignment.worker?.licenses ?? null };
      });
    const machines = column.assignments
      .filter((assignment) => assignment.kind === "MACHINE")
      .map((assignment) => ({
        name: assignment.machine?.nickname ?? assignment.machine?.name ?? assignment.labelSnapshot,
        requiredLicense: assignment.machine?.patentaEnevojshme ?? null,
        plate: assignment.machine?.targe ?? null,
        model: assignment.machine?.model ?? null,
        active: assignment.machine?.isActive ?? null,
      }));
    return {
      source: "live-plan" as const,
      baustelle: column.baustelle?.name ?? column.title,
      note: column.note,
      workers,
      machines,
      warnings: analyzePlanLicenseWarnings(workers, machines, text),
    };
  });

  const savedGroups = plan.savedRows.map((row) => ({
    source: "saved-row" as const,
    baustelle: row.baustelleName,
    note: row.note,
    workers: row.workerNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, licenses: null })),
    machines: row.machineNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, requiredLicense: null, plate: null, model: null, active: null })),
    warnings: [] as string[],
  }));

  const groups = liveGroups.length > 0 ? liveGroups : savedGroups;
  const filtered = groups.filter((group) => {
    const workerMatch = !workerNeedle || group.workers.some((worker) => worker.name.toLowerCase().includes(workerNeedle));
    const baustelleMatch = !baustelleNeedle || group.baustelle.toLowerCase().includes(baustelleNeedle);
    return workerMatch && baustelleMatch;
  });

  return {
    ok: true as const,
    date: key,
    groups: filtered,
    message:
      filtered.length === 0
        ? text.noMatchingPlanGroup(key)
        : text.matchingPlanGroups(filtered.length, key),
  };
}
