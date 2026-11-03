/**
 * Real staff and fleet lists of a company, imported once at deploy time.
 *
 * The operator puts the rows (as the company sent them in its spreadsheets) into
 * `ROSTER_IMPORT_JSON` on the hosting service: base64 of gzipped JSON. Personal
 * data never goes into the repository, including the national ID numbers
 * (stored on the worker for HR, shown only to the office and the worker).
 *
 *   { "company": "<legal name>",
 *     "retireSamples": true,
 *     "workers":  [[group, firstName, lastName, "dd.mm.yyyy", position, license, extra, nationalId], ...],
 *     "machines": [[type, plate, brand, model, owner, tonnage, kolaudim, insurance, tax, permit, tachograph, note], ...],
 *     "sites":    [[name, STEEL_WORKSHOP | STEEL_ASSEMBLY | OTHER, address, description, [[fileName, base64], ...]], ...] }
 *                 (optional; added when the name is new. The files go into the site documents;
 *                  element lists among them also fill the factory and field lists.)
 *
 * group is office | factory | field. Dates are dd.mm.yyyy or mm.yyyy (start of that month).
 */
import { gunzipSync } from 'node:zlib';

import type { CrewRole } from '@/lib/workzone/crew-roles';

export type RosterGroup = 'office' | 'factory' | 'field';
type Level = 'WORKER' | 'VORARBEITER' | 'MEISTER';

export type RosterWorker = {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  position: string;
  licenses: string | null;
  nationalId: string | null;
  crewRole: CrewRole | null;
  level: Level;
  language: 'SQ' | 'EN';
};

export type RosterMachine = {
  name: string;
  nickname: string;
  funksioni: string;
  category: 'TRUCK' | 'AWP' | 'OTHER';
  targe: string | null;
  model: string | null;
  ownership: string | null;
  tonnage: number | null;
  tuvDate: Date | null;
  insuranceDate: Date | null;
  taxDate: Date | null;
  transportPermitDate: Date | null;
  tachographDate: Date | null;
  notes: string | null;
};

export type RosterSite = {
  name: string;
  type: 'STEEL_WORKSHOP' | 'STEEL_ASSEMBLY' | 'OTHER';
  address: string | null;
  description: string | null;
  files: Array<{ fileName: string; bytes: Uint8Array<ArrayBuffer> }>;
};

export type RosterInput = {
  company: string;
  retireSamples: boolean;
  sites: RosterSite[];
  workers: RosterWorker[];
  machines: RosterMachine[];
};

const clean = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

/** "YUVRAJ" -> "Yuvraj"; names already in mixed case stay as written. */
export function displayName(value: string) {
  const text = clean(value);
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, sep: string, letter: string) => sep + letter.toUpperCase(),
    );
}

/** dd.mm.yyyy, or mm.yyyy for "some day that month" (the first, so reminders come early). */
export function parseRosterDate(value: unknown): Date | null {
  const text = clean(value);
  const full = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (full) {
    const date = new Date(
      Date.UTC(Number(full[3]), Number(full[2]) - 1, Number(full[1]), 12),
    );
    return date.getUTCDate() === Number(full[1]) ? date : null;
  }
  const month = text.match(/^(\d{1,2})\.(\d{4})$/);
  if (month)
    return new Date(Date.UTC(Number(month[2]), Number(month[1]) - 1, 1, 12));
  return null;
}

/** Crew role and level from the group and job title of the company's list. */
export function roleFor(
  group: RosterGroup,
  position: string,
): { crewRole: CrewRole | null; level: Level } {
  const p = position.toLowerCase();
  if (group === 'factory') {
    return /inxhinier/.test(p)
      ? { crewRole: 'FACTORY_ENGINEER', level: 'MEISTER' }
      : { crewRole: 'FACTORY_WORKER', level: 'WORKER' };
  }
  if (group === 'field') {
    return /p[eë]rgjegj[eë]s/.test(p)
      ? { crewRole: 'FIELD_ENGINEER', level: 'VORARBEITER' }
      : { crewRole: 'FIELD_WORKER', level: 'WORKER' };
  }
  if (/zbatim/.test(p))
    return { crewRole: 'FIELD_ENGINEER', level: 'VORARBEITER' };
  if (/shofer|magazinier/.test(p))
    return { crewRole: 'FIELD_WORKER', level: 'WORKER' };
  if (/pastrues/.test(p)) return { crewRole: null, level: 'WORKER' };
  return { crewRole: 'OFFICE', level: 'WORKER' };
}

function machineCategory(type: string): RosterMachine['category'] {
  const t = type.toLowerCase();
  if (/platform/.test(t)) return 'AWP';
  if (
    /kamion|t[eë]rheq[eë]s|gjysm[eë]rimorkio|karroceri|q[eë]llime t[eë] ve[cç]anta/.test(
      t,
    )
  )
    return 'TRUCK';
  return 'OTHER';
}

function parseWorker(row: unknown): RosterWorker | null {
  if (!Array.isArray(row)) return null;
  const [group, first, last, birth, position, license, extra, nationalId] = row.map(clean);
  if (group !== 'office' && group !== 'factory' && group !== 'field')
    return null;
  if (!first || !last) return null;
  const licenses = [license, extra].filter(Boolean).join(' · ') || null;
  // The company writes foreign staff in capitals; they get the app in English.
  const foreign = first === first.toUpperCase() && last === last.toUpperCase();
  return {
    firstName: displayName(first),
    lastName: displayName(last),
    birthDate: parseRosterDate(birth),
    position: position ?? '',
    licenses,
    nationalId: nationalId ? nationalId.toUpperCase() : null,
    ...roleFor(group, position ?? ''),
    language: foreign ? 'EN' : 'SQ',
  };
}

function parseMachine(row: unknown, company: string): RosterMachine | null {
  if (!Array.isArray(row)) return null;
  const [
    type,
    plate,
    brand,
    model,
    owner,
    tonnage,
    kolaudim,
    insurance,
    tax,
    permit,
    tachograph,
    note,
  ] = row.map(clean);
  if (!type) return null;
  // "Iveco Magirus" + "Magirus" reads as one name, not "Iveco Magirus Magirus".
  const vehicle =
    model && brand?.toLowerCase().includes(model.toLowerCase())
      ? brand
      : [brand, model].filter(Boolean).join(' ');
  const nickname = vehicle && plate ? vehicle : type;
  const targe = plate || null;
  const tons = Number((tonnage ?? '').replace(',', '.'));
  const ownCompany = owner
    ? owner.toLowerCase().startsWith(company.toLowerCase().slice(0, 6))
    : true;
  return {
    name: targe ? `${nickname} · ${targe}` : type,
    nickname,
    funksioni: type,
    category: machineCategory(type),
    targe,
    model: vehicle || null,
    ownership: owner && !ownCompany ? owner : null,
    tonnage: tonnage && Number.isFinite(tons) && tons > 0 ? tons : null,
    tuvDate: parseRosterDate(kolaudim),
    insuranceDate: parseRosterDate(insurance),
    taxDate: parseRosterDate(tax),
    transportPermitDate: parseRosterDate(permit),
    tachographDate: parseRosterDate(tachograph),
    notes: note || null,
  };
}

/** Reads ROSTER_IMPORT_JSON (base64 gzip, or plain JSON for local runs). Null when unset. */
export function parseRosterInput(raw: string | undefined): RosterInput | null {
  const text = raw?.trim();
  if (!text) return null;
  const json = text.startsWith('{')
    ? text
    : gunzipSync(Buffer.from(text, 'base64')).toString('utf8');
  const data = JSON.parse(json) as {
    company?: unknown;
    retireSamples?: unknown;
    workers?: unknown;
    machines?: unknown;
    sites?: unknown;
  };
  const company = clean(data.company);
  if (!company)
    throw new Error("ROSTER_IMPORT_JSON needs the company's legal name.");
  const workers = (Array.isArray(data.workers) ? data.workers : [])
    .map(parseWorker)
    .filter((w): w is RosterWorker => w !== null);
  const machines = (Array.isArray(data.machines) ? data.machines : [])
    .map((row) => parseMachine(row, company))
    .filter((m): m is RosterMachine => m !== null);
  const sites = (Array.isArray(data.sites) ? data.sites : []).flatMap((row): RosterSite[] => {
    if (!Array.isArray(row)) return [];
    const [name, type, address, description] = row.slice(0, 4).map(clean);
    if (!name) return [];
    const kind = type === 'STEEL_WORKSHOP' || type === 'STEEL_ASSEMBLY' ? type : 'OTHER';
    const files = (Array.isArray(row[4]) ? row[4] : []).flatMap((file: unknown) => {
      if (!Array.isArray(file)) return [];
      const fileName = clean(file[0]);
      const data = typeof file[1] === 'string' ? Buffer.from(file[1], 'base64') : null;
      if (!fileName || !data || data.byteLength === 0) return [];
      return [{ fileName, bytes: new Uint8Array(data) }];
    });
    return [{ name, type: kind, address: address || null, description: description || null, files }];
  });
  return {
    company,
    retireSamples: data.retireSamples === true,
    sites,
    workers,
    machines,
  };
}
