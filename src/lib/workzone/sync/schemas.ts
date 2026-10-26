import { z } from "zod";

import type { WorkzoneActorKind } from "@/lib/workzone/offline/types";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

export const actorKindEnum = z.enum(["WORKER", "ADMIN"] satisfies [WorkzoneActorKind, WorkzoneActorKind]);

export const entityTypeEnum = z.enum([
  "WORKER",
  "BAUSTELLE",
  "TREE",
  "MANUAL_TASK",
  "WORK_SESSION",
  "INVENTORY",
]);

export const actionTypeEnum = z.enum([
  "START_WORK",
  "STOP_WORK",
  "CHECK_TREE",
  "UNDO_TREE",
  "ADD_MANUAL_TASK",
  "CLEAR_MANUAL_TASK",
  "ADD_REPORT_NOTE",
  "SITE_EQUIPMENT_MOVEMENT",
  "UPLOAD_DOCUMENT",
]);

export const pendingActionSchema = z.object({
  id: z.string().uuid(),
  type: actionTypeEnum,
  actorKind: actorKindEnum,
  actorId: z.string().min(1).max(128),
  companyProfileId: z.string().min(1).max(128),
  entityType: entityTypeEnum,
  entityId: z.string().min(1).max(256),
  payload: z.unknown(),
  baseUpdatedAt: z.string().datetime().optional(),
  baseVersion: z.string().optional(),
  clientCreatedAt: z.string().datetime(),
});

export const syncRequestSchema = z.object({
  actions: z.array(pendingActionSchema).min(1).max(50),
});

export const startWorkPayloadSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  startTime: z.string().datetime().optional(),
});

export const stopWorkPayloadSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  endTime: z.string().datetime().optional(),
  breakMinutes: z.coerce.number().int().min(0).max(480).optional(),
});

export const checkTreePayloadSchema = z.object({
  treeItemId: z.string().min(1),
  workerId: z.string().min(1),
  baustelleId: z.string().min(1),
  done: z.boolean(),
});

export const addManualTaskPayloadSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  description: z.string().min(1).max(2000),
});

export const clearManualTaskPayloadSchema = z.object({
  taskId: z.string().min(1),
  workerId: z.string().min(1),
  baustelleId: z.string().min(1),
});

export const addReportNotePayloadSchema = z.object({
  workerId: z.string().min(1),
  type: z.enum(["DAILY", "MONTHLY"]),
  periodKey: z.string().min(1).max(32),
  note: z.string().min(1).max(10_000),
});

export const siteEquipmentMovementPayloadSchema = z.object({
  movementType: z.enum(["REQUEST", "DEPLOY", "COLLECT", "SET_QUANTITY"]),
  baustelleId: z.string().min(1),
  category: z.enum(["SIGN", "PLATE", "FENCE"]),
  quantity: z.coerce.number().int().min(1).optional(),
  targetQuantity: z.coerce.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
  workerId: z.string().min(1),
  treeItemId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export type PendingAction = z.infer<typeof pendingActionSchema>;

export type AuthContext =
  | { kind: "WORKER"; id: string; companyProfileId: string }
  | { kind: "ADMIN"; id: string; companyProfileId: string };
