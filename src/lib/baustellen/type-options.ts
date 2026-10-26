import type { CompanyMode } from "@/lib/mode-config";
import type { BaustelleType } from "@/generated/prisma/enums";

export type BaustelleTypeOption = {
  value: BaustelleType;
  labelKey: string;
  longLabelKey?: string;
};

export const BAUMDIENST_BAUSTELLE_TYPES: BaustelleTypeOption[] = [
  { value: "TRUCK_PLATFORM", labelKey: "admin.baustelleTypeTruckPlatform", longLabelKey: "admin.baustelleTypeTruckPlatformLong" },
  { value: "TRUCK_CRANE", labelKey: "admin.baustelleTypeTruckCrane", longLabelKey: "admin.baustelleTypeTruckCraneLong" },
  { value: "CLIMBING", labelKey: "admin.baustelleTypeClimbing", longLabelKey: "admin.baustelleTypeClimbingLong" },
  { value: "WATERING", labelKey: "admin.baustelleTypeWatering" },
  { value: "EXCAVATOR", labelKey: "admin.baustelleTypeExcavator" },
];

export const BAU_BAUSTELLE_TYPES: BaustelleTypeOption[] = [
  { value: "SIGNAGE", labelKey: "admin.baustelleTypeSignage" },
  { value: "DRAINAGE", labelKey: "admin.baustelleTypeDrainage" },
  { value: "WALL", labelKey: "admin.baustelleTypeWall" },
  { value: "PAVING", labelKey: "admin.baustelleTypePaving" },
  { value: "PAINTING", labelKey: "admin.baustelleTypePainting" },
  { value: "RENOVATION", labelKey: "admin.baustelleTypeRenovation" },
  { value: "OTHER", labelKey: "admin.baustelleTypeOther" },
];

export function baustelleTypeOptionsForMode(mode: CompanyMode) {
  return mode === "bau" ? BAU_BAUSTELLE_TYPES : BAUMDIENST_BAUSTELLE_TYPES;
}

export function defaultBaustelleTypeForMode(mode: CompanyMode) {
  return baustelleTypeOptionsForMode(mode)[0]?.value ?? "CLIMBING";
}
