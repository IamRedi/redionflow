import { describe, expect, it } from 'vitest';
import { suggestVehicleMatches } from './matching';

const vehicle = (id = 'vehicle-a', extra = {}) => ({ id, name: 'Synthetic van', nickname: null, targe: 'ZZ 123 YY', gpsEnabled: false, ...extra });
const device = (id = 'device-a', extra = {}) => ({ id, name: 'VAN [ZZ123YY]', plate: null, machineId: null, available: true, ...extra });
const match = (devices = [device()], vehicles = [vehicle()]) => [...suggestVehicleMatches(devices, vehicles)];

describe('WanWay vehicle suggestions', () => {
  it.each(['ZZ123YY', 'zz 123 yy', 'VAN [ZZ 123 YY]', 'Van (ZZ-123-YY) office', 'ZZ.123.YY'])('finds the complete plate in %s', (name) => {
    expect(match([device('d', { name })])).toEqual([['d', 'vehicle-a']]);
  });

  it('matches a reported plate and exact normalized vehicle names or nicknames', () => {
    expect(match([device('d', { name: 'GPS', plate: 'zz123yy' })])).toEqual([['d', 'vehicle-a']]);
    expect(match([device('d', { name: 'SYNTHETIC-VAN' })])).toEqual([['d', 'vehicle-a']]);
    expect(match([device('d', { name: 'Shkalle e kuqe' })], [vehicle('v', { nickname: 'Shkallë e kuqe' })])).toEqual([['d', 'v']]);
  });

  it.each(['VAN ZZ123YX', 'XZZ123YY', 'ZZ123YY9', 'VAN', ''])('leaves unknown, incomplete or different identifiers manual: %s', (name) => {
    expect(match([device('d', { name })])).toEqual([]);
  });

  it('does not select a vehicle when the name and reported plate disagree', () => {
    expect(match([device('d', { plate: 'XX456WW' })], [vehicle(), vehicle('other', { targe: 'XX456WW' })])).toEqual([]);
  });

  it('does not choose between duplicate vehicle names or plates', () => {
    expect(match([device()], [vehicle(), vehicle('duplicate')])).toEqual([]);
    expect(match([device('d', { name: 'Synthetic van' })], [vehicle(), vehicle('duplicate', { targe: 'XX456WW' })])).toEqual([]);
  });

  it('does not propose the same vehicle to two unbound GPS devices', () => {
    expect(match([device('one'), device('two')])).toEqual([]);
  });

  it('preserves existing links and excludes vehicles claimed by another GPS', () => {
    const linked = device('linked', { machineId: 'vehicle-a', name: 'Renamed GPS', available: false });
    expect(match([linked, device()])).toEqual([]);
    expect(match([device('linked', { machineId: 'somewhere-else' })])).toEqual([]);
    expect(match([device()], [vehicle('vehicle-a', { gpsEnabled: true })])).toEqual([]);
  });

  it('does not suggest unavailable devices or empty aliases', () => {
    expect(match([device('d', { available: false })])).toEqual([]);
    expect(match([device('d', { name: '---' })], [vehicle('v', { name: '', nickname: '', targe: '' })])).toEqual([]);
  });

  it('returns independent suggestions without changing the input', () => {
    const devices = [device(), device('second', { name: 'Truck XX456WW' })];
    const vehicles = [vehicle(), vehicle('truck', { targe: 'XX456WW' })];
    const before = JSON.stringify({ devices, vehicles });
    expect(match(devices, vehicles)).toEqual([['device-a', 'vehicle-a'], ['second', 'truck']]);
    expect(JSON.stringify({ devices, vehicles })).toBe(before);
  });
});
