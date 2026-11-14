import { assertMusterFleetTarget } from './bauflow-muster-fleet';

/** Existing fictional inventory identities; not a name lookup for customer data. */
export const BAUFLOW_MUSTER_INVENTORY = [
  { key: 'akku-schlagschrauber', name: 'Akku-Schlagschrauber', code: 'BF-MU-001' },
  { key: 'winkelschleifer', name: 'Winkelschleifer', code: 'BF-MU-002' },
  { key: 'rotationslaser', name: 'Rotationslaser', code: 'BF-MU-003' },
  { key: 'schweissgeraet', name: 'Schweißgerät MIG/MAG', code: 'BF-MU-004' },
  { key: 'drehmomentschluessel', name: 'Drehmomentschlüssel', code: 'BF-MU-005' },
] as const;

export function assertMusterInventoryTarget(env: Readonly<Record<string, string | undefined>>) {
  // Reuse the exact dedicated-host/database/profile fence, with a separate opt-in.
  return assertMusterFleetTarget({ ...env, BAUFLOW_MUSTER_FLEET_APPLY: env.BAUFLOW_MUSTER_INVENTORY_APPLY });
}
