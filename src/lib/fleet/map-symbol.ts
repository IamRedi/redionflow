export function siteMapSymbol(type: string, isBau: boolean, progress = 0) {
  if (isBau || type === 'STEEL_ASSEMBLY' || type === 'STEEL_WORKSHOP')
    return type === 'SIGNAGE' ? '🚧' : '🏗️';
  if (type === 'WATERING') return '🐘';
  if (type === 'EXCAVATOR') return '🚜';
  if (type === 'TRUCK_CRANE') return '🏗️';
  if (type === 'TRUCK_PLATFORM') return '🚚';
  return progress >= 70 ? '🌳' : progress >= 30 ? '🌿' : '🪵';
}
