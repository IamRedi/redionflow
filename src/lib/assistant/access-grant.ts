/**
 * Pure matching for the one-time "only these people may use the AI" setup.
 * A name matches a person's full name or first name, ignoring case and
 * accents. One person may hold both an admin login and a worker record; a
 * name that matches one admin and one worker whose names agree (equal, or one
 * is the start of the other, e.g. "Megi" and "Megi Hoxha") is that person
 * and enables both. Anything else (nobody, two admins, two workers) grants
 * nothing.
 */
export type GrantPerson = { kind: "admin" | "worker"; id: string; fullName: string; firstName: string };

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

export function parseAccessNames(raw: string | undefined) {
  return [...new Set((raw ?? "").split(",").map(name => name.trim()).filter(Boolean))];
}

export function matchAccessNames(names: string[], people: GrantPerson[]) {
  return names.map(name => {
    const wanted = fold(name);
    const matches = people.filter(p => fold(p.fullName) === wanted || fold(p.firstName) === wanted);
    return { name, matches };
  });
}

/** The records to enable for one name, or none when the name is ambiguous. */
export function grantTargets(matches: GrantPerson[]) {
  if (matches.length === 1) return matches;
  if (matches.length !== 2 || matches[0].kind === matches[1].kind) return [];
  const [a, b] = matches.map(p => fold(p.fullName));
  const agree = a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
  return agree ? matches : [];
}
