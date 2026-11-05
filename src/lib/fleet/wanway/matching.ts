type Device = {
  id: string;
  name: string;
  plate?: string | null;
  machineId: string | null;
  available: boolean;
};

type Vehicle = {
  id: string;
  name: string;
  nickname?: string | null;
  targe: string | null;
  gpsEnabled: boolean;
};

function letters(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase();
}

const normalized = (value: string) => letters(value).replace(/[^A-Z0-9]/g, '');

/** A plate may occur inside a device label, separated by spaces or punctuation. */
function containsPlate(name: string, plate: string) {
  const key = normalized(plate);
  if (key.length < 3 || !/\d/.test(key)) return false;
  const pattern = key.split('').join('[\\s\\p{P}]*');
  return new RegExp(`(?:^|[^A-Z0-9])${pattern}(?:$|[^A-Z0-9])`, 'u').test(letters(name));
}

/**
 * Read-only suggestions, never bindings. Require one exact normalized name,
 * nickname or plate match, and one unbound available device for that vehicle.
 * Ambiguous labels, conflicting matches and existing GPS claims stay manual.
 */
export function suggestVehicleMatches(devices: readonly Device[], vehicles: readonly Vehicle[]) {
  const claimed = new Set(devices.flatMap((device) => device.machineId ? [device.machineId] : []));
  const candidates = new Map<string, string>();
  const claimCounts = new Map<string, number>();

  for (const device of devices) {
    if (device.machineId || !device.available) continue;
    const name = normalized(device.name);
    const plate = device.plate ? normalized(device.plate) : '';
    const matches = vehicles.filter((vehicle) => {
      const vehiclePlate = vehicle.targe ? normalized(vehicle.targe) : '';
      return Boolean(
        (name && [vehicle.name, vehicle.nickname].some((alias) => alias && normalized(alias) === name)) ||
        (vehiclePlate && ((plate && plate === vehiclePlate) || containsPlate(device.name, vehicle.targe!))),
      );
    });
    if (matches.length !== 1) continue;
    const [match] = matches;
    if (match.gpsEnabled || claimed.has(match.id)) continue;
    candidates.set(device.id, match.id);
    claimCounts.set(match.id, (claimCounts.get(match.id) ?? 0) + 1);
  }

  return new Map([...candidates].filter(([, vehicleId]) => claimCounts.get(vehicleId) === 1));
}
