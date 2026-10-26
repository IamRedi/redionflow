import { z } from "zod";
import { t } from "../i18n";

/** Prozentangaben wie in der UI: 0–100 (z. B. 18 für 18 %) */
export const settingsFormSchema = z.object({
  companyId: z.string().min(1),
  displayName: z.string().min(1, t("validation.displayNameRequired")),
  legalName: z.string().min(1, t("validation.legalNameRequired")),
  bgkPct: z.coerce.number().min(0).max(100),
  agkPct: z.coerce.number().min(0).max(100),
  riskPct: z.coerce.number().min(0).max(100),
  profitPct: z.coerce.number().min(0).max(100),
  vatPct: z.coerce.number().min(0).max(100),
  bgkBase: z.enum(["EK_TOTAL", "LABOR_ONLY"]),
  riskProfitMode: z.enum(["SEPARATE", "COMBINED"]),
  applyVatByDefault: z.boolean(),
  fleetGpsEnabled: z.boolean(),
  workerPhoneGpsEnabled: z.boolean(),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export const createProjectSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1, t("validation.titleRequired")),
  customerName: z.string().min(1, t("validation.customerRequired")),
});

export type CreateProjectValues = z.infer<typeof createProjectSchema>;

export const applyTemplateSchema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
});

export type ApplyTemplateValues = z.infer<typeof applyTemplateSchema>;

export const quickBaumfaellungSchema = z.object({
  projectId: z.string().min(1),
  climberRoleId: z.string().min(1, t("validation.skilledWorkerRequired")),
  helperRoleId: z.string().min(1, t("validation.helperRequired")),
  truckMachineId: z.string().min(1, t("validation.truckRequired")),
  chipperMachineId: z.string().min(1, t("validation.chipperRequired")),
});

export type QuickBaumfaellungValues = z.infer<typeof quickBaumfaellungSchema>;

export const workzoneCheckTreeSchema = z.object({
  treeItemId: z.string().min(1),
  workerId: z.string().min(1),
  done: z.boolean(),
});

export type WorkzoneCheckTreeValues = z.infer<typeof workzoneCheckTreeSchema>;

export const workzoneEditTreeSchema = z.object({
  treeItemId: z.string().min(1),
  workerId: z.string().min(1),
  species: z.string().min(1, t("validation.speciesRequired")).max(300),
  diameter: z.coerce.number().int().min(0).max(1000),
  note: z.string().max(2000).optional(),
  branchCutsOver10: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(99).optional(),
  ),
  branchCutsOver20: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(99).optional(),
  ),
  branchCutsOver30: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(99).optional(),
  ),
  extraWork: z.enum(["", "25% +", "50% +", "75% +", "100% +"]).optional(),
});

export type WorkzoneEditTreeValues = z.infer<typeof workzoneEditTreeSchema>;

export const workzoneToggleHaltSchema = z.object({
  treeItemId: z.string().min(1),
  workerId: z.string().min(1),
  active: z.boolean(),
});

export type WorkzoneToggleHaltValues = z.infer<typeof workzoneToggleHaltSchema>;

export const workzoneManualTaskSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  description: z.string().min(1, t("validation.descriptionRequired")).max(2000),
});

export type WorkzoneManualTaskValues = z.infer<typeof workzoneManualTaskSchema>;

export const workzoneWorkingSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
});

export type WorkzoneWorkingValues = z.infer<typeof workzoneWorkingSchema>;

export const startWorkSessionSchema = z.object({
  workerId: z.string().min(1),
  startTime: z.string().min(1).optional(),
});

export type StartWorkSessionValues = z.infer<typeof startWorkSessionSchema>;

export const workzoneStartWorkingSchema = workzoneWorkingSchema.extend({
  startTime: z.string().min(1).optional(),
});

export type WorkzoneStartWorkingValues = z.infer<typeof workzoneStartWorkingSchema>;

export const workzoneStopWorkingSchema = workzoneWorkingSchema.extend({
  endTime: z.string().min(1).optional(),
  breakMinutes: z.coerce.number().int().refine((value) => [0, 15, 30, 60].includes(value), t("validation.breakMinutesInvalid")).optional(),
});

export type WorkzoneStopWorkingValues = z.infer<typeof workzoneStopWorkingSchema>;

export const addExternalWorkerSchema = z.object({
  baustelleId: z.string().min(1),
  addedByWorkerId: z.string().min(1),
  firstName: z.string().min(1, t("validation.firstNameRequired")).max(120),
  lastName: z.string().max(120).optional(),
  phone: z.string().max(80).optional(),
});

export type AddExternalWorkerValues = z.infer<typeof addExternalWorkerSchema>;

export const workerLoginSchema = z.object({
  name: z.string().min(1, t("validation.nameRequired")).max(200),
  loginCode: z.string().regex(/^\d{6}$/, t("validation.codeSixDigits")),
});

export type WorkerLoginValues = z.infer<typeof workerLoginSchema>;

export const stopWorkSessionSchema = z.object({
  sessionId: z.string().min(1),
  breakMinutes: z.coerce.number().int().refine((value) => [0, 15, 30, 60].includes(value), t("validation.breakMinutesInvalid")),
  endTime: z.string().min(1),
});

export type StopWorkSessionValues = z.infer<typeof stopWorkSessionSchema>;

export const reportNoteSchema = z.object({
  workerId: z.string().min(1),
  type: z.enum(["DAILY", "MONTHLY"]),
  periodKey: z.string().min(7).max(10),
  note: z.string().max(3000),
});

export type ReportNoteValues = z.infer<typeof reportNoteSchema>;

const baustelleTypeSchema = z.enum([
  "TRUCK_PLATFORM",
  "TRUCK_CRANE",
  "CLIMBING",
  "WATERING",
  "EXCAVATOR",
  "SIGNAGE",
  "DRAINAGE",
  "WALL",
  "PAVING",
  "PAINTING",
  "RENOVATION",
  "OTHER",
]);

export const createBaustelleSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1, t("validation.nameRequired")).max(300),
  type: baustelleTypeSchema,
  status: z.enum(["active", "inactive"]),
  address: z.string().max(400).optional(),
  description: z.string().max(8000).optional(),
  documentsText: z.string().max(8000).optional(),
  createFirstTreeItem: z.boolean().optional(),
  firstTreeId: z.string().max(80).optional(),
  firstTreeSpecies: z.string().max(300).optional(),
  firstTreeDiameter: z.coerce.number().int().min(0).max(1000).optional(),
  firstTreeNote: z.string().max(2000).optional(),
});

export type CreateBaustelleValues = z.infer<typeof createBaustelleSchema>;

export const updateBaustelleMetaSchema = z.object({
  baustelleId: z.string().min(1),
  name: z.string().min(1, t("validation.nameRequired")).max(300),
  type: baustelleTypeSchema,
  status: z.enum(["active", "inactive"]),
  address: z.string().max(400).optional(),
  description: z.string().max(8000).optional(),
});

export type UpdateBaustelleMetaValues = z.infer<typeof updateBaustelleMetaSchema>;

export const updateBaustelleCanvasPositionSchema = z.object({
  baustelleId: z.string().min(1),
  x: z.coerce.number().int().min(0).max(5000),
  y: z.coerce.number().int().min(0).max(5000),
  viewport: z.enum(["desktop", "mobile"]).default("desktop"),
});

export type UpdateBaustelleCanvasPositionValues = z.infer<typeof updateBaustelleCanvasPositionSchema>;

export const updateProjectMetaSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, t("validation.titleRequired")),
  customerName: z.string().min(1, t("validation.customerRequired")),
  customerStreet: z.string().max(500).optional(),
  customerZip: z.string().max(20).optional(),
  customerCity: z.string().max(100).optional(),
  internalNotes: z.string().max(8000).optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "SENT", "ACCEPTED", "LOST", "ARCHIVED"]),
});

export type UpdateProjectMetaValues = z.infer<typeof updateProjectMetaSchema>;

/** Position-Stammdaten (FormData → Server Action) */
export const positionMetaFormSchema = z.object({
  positionId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1, t("validation.titleRequired")),
  description: z.string().max(8000).optional(),
  unit: z.string().min(1).max(80),
  quantity: z.string().min(1),
  notes: z.string().max(8000).optional(),
  manualAdjustmentEur: z.coerce.number().finite(),
});
