"use server";

import { revalidatePath } from "next/cache";

import { getPilotAdmin as getCurrentAdmin, getPilotCompanyId as getCurrentCompanyId } from "@/lib/auth/pilot-session";
import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import { t } from "@/lib/i18n";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { sendNotification } from "@/lib/notifications/sendNotification";
import type { ActionResult } from "@/lib/validation/action-result";
import { dateKey, dayRange, isTomorrow } from "@/lib/workzone/date-utils";

function planDay(value: string) {
  const range = dayRange(value);
  if (Number.isNaN(range.start.getTime())) return null;
  return range.start;
}

function msg(lang: string | undefined, key: string, replacements: Record<string, string> = {}) {
  let value = t(`workzone.${key}`, lang);
  for (const [token, replacement] of Object.entries(replacements)) {
    value = value.replace(`{${token}}`, replacement);
  }
  return value;
}

type PlanRowSnapshot = {
  workerNames: string;
  machineNames: string;
  baustelleName: string;
  note: string | null;
  sortOrder: number;
};

function normalizeRow(row: PlanRowSnapshot) {
  return {
    workerNames: row.workerNames.trim(),
    machineNames: row.machineNames.trim(),
    baustelleName: row.baustelleName.trim(),
    note: row.note?.trim() || null,
    sortOrder: row.sortOrder,
  };
}

function rowsAreEqual(previous: PlanRowSnapshot[], next: PlanRowSnapshot[]) {
  if (previous.length !== next.length) return false;
  return previous.every((row, index) => {
    const a = normalizeRow(row);
    const b = normalizeRow(next[index] ?? { workerNames: "", machineNames: "", baustelleName: "", note: null, sortOrder: -1 });
    return (
      a.workerNames === b.workerNames &&
      a.machineNames === b.machineNames &&
      a.baustelleName === b.baustelleName &&
      a.note === b.note &&
      a.sortOrder === b.sortOrder
    );
  });
}

export async function ensureDailyPlanAction(input: { date: string; skipRevalidate?: boolean; lang?: string }): Promise<ActionResult & { planId?: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: msg(input.lang, "dailyPlanAdminCreateOnly") };
  const day = planDay(input.date);
  if (!day) return { ok: false, message: msg(input.lang, "invalidDate") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: msg(input.lang, "notSignedIn") };
  const result = await withPilotDbContext<ActionResult & { planId?: string }>(currentCompanyId, async tx => {
    const company = await tx.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { id: true } });
    if (!company || company.id !== currentCompanyId) return { ok: false, message: msg(input.lang, "companyNotFound") };

    const plan = await tx.dailyWorkPlan.upsert({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: day } },
      create: {
        companyProfileId: company.id,
        planDate: day,
        createdByAdminId: admin.id,
        columns: {
          create: [{ title: msg(input.lang, "newSite"), sortOrder: 0 }],
        },
      },
      update: {},
      select: { id: true, planDate: true },
    });

    return { ok: true, message: msg(input.lang, "dailyPlanPrepared"), planId: plan.id };
  }, "admin");
  if (!result.ok) return result;

  if (!input.skipRevalidate) {
    revalidatePath("/workzone");
    revalidatePath(`/workzone/plan?date=${dateKey(day)}`);
  }
  notifyRealtimeUpdate("plan.updated", ["daily-plan"]);
  return result;
}

type MoveDailyPlanItemResult = ActionResult & {
  requiresConfirmation?: boolean;
  warningMessage?: string;
};

export async function moveDailyPlanItemAction(input: {
  date: string;
  columnId: string;
  kind: "WORKER" | "MACHINE";
  itemId: string;
  force?: boolean;
  lang?: string;
}): Promise<MoveDailyPlanItemResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: msg(input.lang, "dailyPlanAdminAssignOnly") };
  const day = planDay(input.date);
  if (!day) return { ok: false, message: msg(input.lang, "invalidDate") };
  const range = dayRange(input.date);

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: msg(input.lang, "notSignedIn") };
  const result = await withPilotDbContext<MoveDailyPlanItemResult>(currentCompanyId, async tx => {
    const targetBaustelle = await tx.baustelle.findFirst({
      where: { id: input.columnId, companyProfileId: currentCompanyId },
      select: { id: true, name: true },
    });
    if (!targetBaustelle) return { ok: false, message: msg(input.lang, "siteNotFound") };
    const ownedItem = input.kind === "WORKER"
      ? await tx.worker.findFirst({ where: { id: input.itemId, companyProfileId: currentCompanyId }, select: { id: true } })
      : await tx.machine.findFirst({ where: { id: input.itemId, companyProfileId: currentCompanyId }, select: { id: true } });
    if (!ownedItem) return { ok: false, message: msg(input.lang, "assignmentNotFound") };
    const company = await tx.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { id: true } });
    if (!company || company.id !== currentCompanyId) return { ok: false, message: msg(input.lang, "companyNotFound") };
    const plan = await tx.dailyWorkPlan.upsert({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: day } },
      create: { companyProfileId: company.id, planDate: day, createdByAdminId: admin.id },
      update: {},
      select: {
        id: true,
        columns: { select: { id: true, baustelleId: true } },
      },
    });


    let column = plan.columns.find((item) => item.baustelleId === targetBaustelle.id);
    if (!column) {
      const maxOrder = await tx.dailyWorkPlanColumn.aggregate({
        where: { planId: plan.id },
        _max: { sortOrder: true },
      });
      column = await tx.dailyWorkPlanColumn.create({
        data: {
          planId: plan.id,
          baustelleId: targetBaustelle.id,
          title: targetBaustelle.name,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
        select: { id: true, baustelleId: true },
      });
    }

    const maxOrder = await tx.dailyWorkPlanAssignment.aggregate({
      where: { columnId: column.id },
      _max: { sortOrder: true },
    });

    if (input.kind === "WORKER") {
      const worker = await tx.worker.findUnique({
        where: { id: input.itemId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          availability: true,
          vacationRequests: {
            where: {
              status: "APPROVED",
              startDate: { lt: range.end },
              endDate: { gte: day },
            },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!worker) return { ok: false, message: msg(input.lang, "workerNotFound") };
      const workerName = `${worker.firstName} ${worker.lastName}`.trim();
      const isUnavailableForPlanDate = worker.availability !== "AVAILABLE" || worker.vacationRequests.length > 0;
      if (isUnavailableForPlanDate && !input.force) {
        const warningMessage = worker.vacationRequests.length > 0
          ? msg(input.lang, "planWorkerVacationWarning", { name: workerName })
          : msg(input.lang, "planWorkerUnavailableWarning", { name: workerName, status: worker.availability });
        return { ok: false, message: warningMessage, requiresConfirmation: true, warningMessage };
      }
      await tx.dailyWorkPlanAssignment.deleteMany({ where: { kind: "WORKER", workerId: worker.id, column: { planId: plan.id } } });
      const existingInTarget = await tx.dailyWorkPlanAssignment.findFirst({
        where: { columnId: column.id, kind: "WORKER", workerId: worker.id },
        select: { id: true },
      });
      if (!existingInTarget) {
        await tx.dailyWorkPlanAssignment.create({
          data: {
            columnId: column.id,
            kind: "WORKER",
            workerId: worker.id,
            labelSnapshot: workerName,
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          },
        });
      }
    } else {
      const machine = await tx.machine.findUnique({ where: { id: input.itemId }, select: { id: true, name: true, nickname: true, isActive: true } });
      if (!machine) return { ok: false, message: msg(input.lang, "machineNotFound") };
      const machineName = machine.nickname ?? machine.name;
      if (!machine.isActive && !input.force) {
        const warningMessage = msg(input.lang, "planMachineBlockedWarning", { name: machineName });
        return { ok: false, message: warningMessage, requiresConfirmation: true, warningMessage };
      }
      await tx.dailyWorkPlanAssignment.deleteMany({ where: { kind: "MACHINE", machineId: machine.id, column: { planId: plan.id } } });
      const existingInTarget = await tx.dailyWorkPlanAssignment.findFirst({
        where: { columnId: column.id, kind: "MACHINE", machineId: machine.id },
        select: { id: true },
      });
      if (!existingInTarget) {
        await tx.dailyWorkPlanAssignment.create({
          data: {
            columnId: column.id,
            kind: "MACHINE",
            machineId: machine.id,
            labelSnapshot: machineName,
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          },
        });
      }
    }

    return { ok: true, message: msg(input.lang, "dailyPlanAssigned") };
  }, "admin");
  if (!result.ok) return result;

  revalidatePath("/workzone");
  revalidatePath(`/workzone/plan?date=${input.date}`);
  notifyRealtimeUpdate("plan.updated", ["daily-plan"]);
  return result;
}

export async function removeDailyPlanItemAction(input: { date: string; assignmentId: string; lang?: string }): Promise<ActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: msg(input.lang, "dailyPlanAdminRemoveOnly") };
  if (!input.assignmentId) return { ok: false, message: msg(input.lang, "assignmentNotFound") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: msg(input.lang, "notSignedIn") };
  const result = await withPilotDbContext<ActionResult>(currentCompanyId, async tx => {
    const assignment = await tx.dailyWorkPlanAssignment.findFirst({
      where: { id: input.assignmentId, column: { plan: { companyProfileId: currentCompanyId } } },
      include: { column: { select: { planId: true } } },
    });
    if (!assignment) return { ok: false, message: msg(input.lang, "assignmentNotFound") };

    await tx.dailyWorkPlanAssignment.delete({ where: { id: assignment.id } });

    return { ok: true, message: msg(input.lang, "assignmentRemoved") };
  }, "admin");
  if (!result.ok) return result;

  revalidatePath("/workzone");
  revalidatePath(`/workzone/plan?date=${input.date}`);
  notifyRealtimeUpdate("plan.updated", ["daily-plan"]);
  return result;
}

export async function clearDailyPlanAction(input: { date: string; lang?: string }): Promise<ActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: msg(input.lang, "dailyPlanAdminClearOnly") };
  const day = planDay(input.date);
  if (!day) return { ok: false, message: msg(input.lang, "invalidDate") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: msg(input.lang, "notSignedIn") };
  const result = await withPilotDbContext<ActionResult>(currentCompanyId, async tx => {
    const company = await tx.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { id: true } });
    if (!company || company.id !== currentCompanyId) return { ok: false, message: msg(input.lang, "companyNotFound") };

    const plan = await tx.dailyWorkPlan.findUnique({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: day } },
      select: { id: true },
    });
    if (!plan) return { ok: false, message: msg(input.lang, "dailyPlanNotFound") };


      await tx.dailyWorkPlanAssignment.deleteMany({
        where: { column: { planId: plan.id } },
      });
      await tx.dailyWorkPlanColumn.deleteMany({
        where: { planId: plan.id },
      });

    return { ok: true, message: msg(input.lang, "dailyPlanCleared") };
  }, "admin");
  if (!result.ok) return result;

  revalidatePath("/workzone");
  revalidatePath(`/workzone/plan?date=${input.date}`);
  notifyRealtimeUpdate("plan.updated", ["daily-plan"]);
  return result;
}

export async function saveDailyPlanAction(input: { date: string; lang?: string }): Promise<ActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: msg(input.lang, "dailyPlanAdminSaveOnly") };
  const day = planDay(input.date);
  if (!day) return { ok: false, message: msg(input.lang, "invalidDate") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: msg(input.lang, "notSignedIn") };
  let notificationWorkerIds: string[] = [];
  const result = await withPilotDbContext<ActionResult>(currentCompanyId, async tx => {
    const company = await tx.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { id: true } });
    if (!company || company.id !== currentCompanyId) return { ok: false, message: msg(input.lang, "companyNotFound") };
    const plan = await tx.dailyWorkPlan.findUnique({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: day } },
      include: {
        columns: {
          orderBy: { sortOrder: "asc" },
          include: {
            assignments: { orderBy: { sortOrder: "asc" } },
            baustelle: { select: { name: true } },
          },
        },
        savedRows: {
          orderBy: { sortOrder: "asc" },
        },
        snapshots: {
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        },
      },
    });
    if (!plan) return { ok: false, message: msg(input.lang, "dailyPlanNotFound") };

    const rows: PlanRowSnapshot[] = plan.columns.map((column, idx) => {
      const workerNames = column.assignments.filter((a) => a.kind === "WORKER").map((a) => a.labelSnapshot).join(", ");
      const machineNames = column.assignments.filter((a) => a.kind === "MACHINE").map((a) => a.labelSnapshot).join(", ");
      return {
        workerNames,
        machineNames,
        baustelleName: column.baustelle?.name ?? column.title,
        note: column.note ?? null,
        sortOrder: idx,
      };
    });

    const previousRows: PlanRowSnapshot[] = plan.savedRows.map((row) => ({
      workerNames: row.workerNames,
      machineNames: row.machineNames,
      baustelleName: row.baustelleName,
      note: row.note,
      sortOrder: row.sortOrder,
    }));
    const shouldSnapshot = previousRows.length > 0 && !rowsAreEqual(previousRows, rows);


      if (shouldSnapshot) {
        const nextVersion = (plan.snapshots[0]?.versionNumber ?? 0) + 1;
        const snapshot = await tx.dailyWorkPlanSnapshot.create({
          data: {
            planId: plan.id,
            versionNumber: nextVersion,
            createdByAdminId: admin.id,
          },
          select: { id: true },
        });
        await tx.dailyWorkPlanSnapshotRow.createMany({
          data: previousRows.map((row) => ({
            snapshotId: snapshot.id,
            workerNames: row.workerNames,
            machineNames: row.machineNames,
            baustelleName: row.baustelleName,
            note: row.note,
            sortOrder: row.sortOrder,
          })),
        });
      }

      await tx.dailyWorkPlanSavedRow.deleteMany({ where: { planId: plan.id } });
      if (rows.length > 0) {
        await tx.dailyWorkPlanSavedRow.createMany({
          data: rows.map((row) => ({
            planId: plan.id,
            workerNames: row.workerNames,
            machineNames: row.machineNames,
            baustelleName: row.baustelleName,
            note: row.note,
            sortOrder: row.sortOrder,
          })),
        });
      }

    if (isTomorrow(day)) {
      notificationWorkerIds = [
        ...new Set(
          plan.columns
            .flatMap((column) => column.assignments)
            .filter((assignment) => assignment.kind === "WORKER" && assignment.workerId)
            .map((assignment) => assignment.workerId as string),
        ),
      ];
    }
    return { ok: true, message: msg(input.lang, "dailyPlanSaved") };
  }, "admin");
  if (!result.ok) return result;

  if (isTomorrow(day)) {
    await sendNotification({
      userIds: notificationWorkerIds,
      title: msg(input.lang, "dailyPlanTomorrowNotificationTitle"),
      body: msg(input.lang, "dailyPlanTomorrowNotificationBody"),
      url: "/workzone/plan",
      preference: "tagesplan",
    });
  }

  revalidatePath("/workzone");
  revalidatePath(`/workzone/plan?date=${input.date}`);
  notifyRealtimeUpdate("plan.updated", ["daily-plan"]);
  return result;
}

export async function updateDailyPlanColumnNoteAction(input: { date: string; columnId: string; note: string; lang?: string }): Promise<ActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: msg(input.lang, "dailyPlanAdminNotesOnly") };

  const day = planDay(input.date);
  if (!day) return { ok: false, message: msg(input.lang, "invalidDate") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: msg(input.lang, "notSignedIn") };
  const result = await withPilotDbContext<ActionResult>(currentCompanyId, async tx => {
    const targetBaustelle = await tx.baustelle.findFirst({
      where: { id: input.columnId, companyProfileId: currentCompanyId },
      select: { id: true, name: true },
    });
    if (!targetBaustelle) return { ok: false, message: msg(input.lang, "siteNotFound") };
    const company = await tx.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { id: true } });
    if (!company || company.id !== currentCompanyId) return { ok: false, message: msg(input.lang, "companyNotFound") };

    const plan = await tx.dailyWorkPlan.upsert({
      where: { companyProfileId_planDate: { companyProfileId: company.id, planDate: day } },
      create: { companyProfileId: company.id, planDate: day, createdByAdminId: admin.id },
      update: {},
      select: {
        id: true,
        columns: { select: { id: true, baustelleId: true } },
      },
    });


    const noteValue = input.note.trim() ? input.note.trim() : null;
    const existingColumn = plan.columns.find((item) => item.baustelleId === targetBaustelle.id);

    if (existingColumn) {
      await tx.dailyWorkPlanColumn.update({
        where: { id: existingColumn.id },
        data: { note: noteValue },
      });
    } else {
      const maxOrder = await tx.dailyWorkPlanColumn.aggregate({
        where: { planId: plan.id },
        _max: { sortOrder: true },
      });
      await tx.dailyWorkPlanColumn.create({
        data: {
          planId: plan.id,
          baustelleId: targetBaustelle.id,
          title: targetBaustelle.name,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          note: noteValue,
        },
      });
    }

    return { ok: true, message: msg(input.lang, "noteSaved") };
  }, "admin");
  if (!result.ok) return result;

  revalidatePath("/workzone");
  revalidatePath(`/workzone/plan?date=${input.date}`);
  notifyRealtimeUpdate("plan.updated", ["daily-plan"]);
  return result;
}
