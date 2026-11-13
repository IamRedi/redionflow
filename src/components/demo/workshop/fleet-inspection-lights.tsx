"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import { fleetInspectionState } from "@/lib/workshop/fleet-inspections";
import { useFleetInspection } from "./fleet-inspection-context";
import styles from "./workshop.module.css";

const copy: Record<string, { group: string; ok: string; due: string; expired: string; unknown: string }> = {
  en: { group: "Vehicle inspections", ok: "Valid", due: "Due within 30 days", expired: "Expired", unknown: "No date recorded" },
  de: { group: "Fahrzeugprüfungen", ok: "Gültig", due: "Innerhalb von 30 Tagen fällig", expired: "Abgelaufen", unknown: "Kein Termin erfasst" },
  sq: { group: "Kontrollet e mjetit", ok: "Në rregull", due: "Afati brenda 30 ditëve", expired: "Afati ka skaduar", unknown: "Pa afat të regjistruar" },
  it: { group: "Controlli del veicolo", ok: "Valido", due: "Scade entro 30 giorni", expired: "Scaduto", unknown: "Nessuna data registrata" },
  pl: { group: "Badania pojazdu", ok: "Ważne", due: "Termin w ciągu 30 dni", expired: "Wygasło", unknown: "Brak terminu" },
  ro: { group: "Inspecții vehicul", ok: "Valabil", due: "Expiră în 30 de zile", expired: "Expirat", unknown: "Fără dată înregistrată" },
};
export function FleetInspectionLights({ plate, now, detailed = false }: { plate?: string; now: string; detailed?: boolean }) {
  const { currentLang } = useLanguage(), c = copy[currentLang] ?? copy.en, row = useFleetInspection(plate);
  const entries = (["hu", "sp", "uvv"] as const).map(key => {
    const date = row?.[key], state = fleetInspectionState(date, now);
    const value = state === "unknown" ? c.unknown : new Intl.DateTimeFormat(currentLang, { timeZone: "Europe/Berlin", dateStyle: "medium" }).format(new Date(date!));
    return { key, state, value, label: `${key.toUpperCase()}: ${c[state]}${state === "unknown" ? "" : ` · ${value}`}` };
  });
  return <div role="group" aria-label={c.group} className={detailed ? styles.checkDetails : styles.checkStrip} data-testid={detailed ? "fleet-check-details" : "fleet-check-lights"}>{entries.map(e => <span key={e.key} className={styles.check} data-fleet-check={e.key} data-state={e.state} aria-label={e.label} title={e.label}><span aria-hidden="true" className={styles.checkDot} /><span>{e.key.toUpperCase()}</span>{detailed && <span className={styles.checkValue}>{e.value}</span>}</span>)}</div>;
}
