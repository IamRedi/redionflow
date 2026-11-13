"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import styles from "./workshop.module.css";

/** The menu uses the same scoped material as the app, including its portal. */
export function InventoryKindFilter({ value, onChange, labels }: { value: string; onChange: (value: string) => void; labels: { allEquipment: string; onlyFleet: string; onlyTools: string } }) {
  return <Select.Root value={value || "all"} onValueChange={v => onChange(v === "all" ? "" : v)}>
    <Select.Trigger data-ui-control="button" data-ui-variant="outline" aria-label={labels.allEquipment} className={styles.filterTrigger}><Select.Value /><Select.Icon><ChevronDown className="size-4" /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content position="popper" sideOffset={6} collisionPadding={12} className={styles.filterMenu} data-baum-menu><Select.Viewport>
      {[["all", labels.allEquipment], ["fleet", labels.onlyFleet], ["tool", labels.onlyTools]].map(([key, label]) => <Select.Item key={key} value={key} className={styles.filterOption}><Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator><Check className="size-4" /></Select.ItemIndicator></Select.Item>)}
    </Select.Viewport></Select.Content></Select.Portal>
  </Select.Root>;
}
