/**
 * Pure matching for the one-time "only these people may use the AI" setup.
 * A name matches a person's full name or first name, ignoring case and
 * accents. A name that matches nobody or more than one person grants nothing.
 */
export type GrantPerson = { kind: "admin" | "worker"; id: string; fullName: string; firstName: string };

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

export function parseAccessNames(raw: string | undefined) {
  return [...new Set((raw ?? "").split(",").map(name => name.trim()).filter(Boolean))];
}

export function matchAccessNames(names: string[], people: GrantPerson[]) {
  return names.map(name => {
    const wanted = fold(name);
    const full = people.filter(p => fold(p.fullName) === wanted);
    const matches = full.length ? full : people.filter(p => fold(p.firstName) === wanted);
    return { name, matches };
  });
}
