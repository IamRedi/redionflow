type ReceptionPerson = {
  enabled: boolean;
  seat?: 'megi' | 'almet' | 'staff';
  officePresence?: 'active' | 'paused' | null;
};

/** Presentation only: real office presence first, then the configured directors.
 * Keep the server's order within each group and never change access or presence.
 */
export function receptionOrder<T extends ReceptionPerson>(people: readonly T[]): T[] {
  const rank = (person: T) => person.enabled && person.officePresence ? 0 : 1;
  const director = (person: T) => person.seat === 'megi' ? 0 : person.seat === 'almet' ? 1 : 2;
  return [...people].sort((a, b) => rank(a) - rank(b) || director(a) - director(b));
}
