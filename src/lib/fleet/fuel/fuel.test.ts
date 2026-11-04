import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { localClock, parseFuelClock, receiptClock } from './time';
import { closestFuelEvidence } from './evidence';
import { receiptImage, readReceiptText } from './ocr';
import { siteMapSymbol } from '../map-symbol';
import { fleetTime } from '../format';
const zone = 'Europe/Tirane',
  now = new Date('2026-11-04T16:00:00Z');
describe('fuel invoice clocks and original GPS evidence', () => {
  it('renders unambiguous 24-hour GPS clocks with seconds', () => {
    expect(fleetTime('2026-11-04T17:30:29Z', zone, true)).toBe(
      '04.11.2026 18:30:29',
    );
  });
  it('converts invoice clocks in the company timezone independently of the host', () => {
    expect(parseFuelClock('2026-11-04T12:34', zone, now)?.toISOString()).toBe(
      '2026-11-04T11:34:00.000Z',
    );
    expect(parseFuelClock('2026-07-07T12:34', zone, now)?.toISOString()).toBe(
      '2026-07-07T10:34:00.000Z',
    );
    expect(localClock(new Date('2026-11-04T11:34Z'), zone)).toBe(
      '2026-11-04T12:34',
    );
  });
  it.each([
    '2026-02-31T12:00',
    '2026-11-04T25:00',
    '2026-11-04T19:00',
    '2020-01-01T12:00',
    'not-a-clock',
    '2026-03-29T02:30',
  ])(
    'rejects invalid, future, unsupported or nonexistent local time %s',
    (clock) => {
      expect(parseFuelClock(clock, zone, now)).toBeNull();
    },
  );
  it('requires an explicit offset for ambiguous autumn clocks', () => {
    expect(parseFuelClock('2026-10-25T02:30', zone, now)).toBeNull();
    expect(
      parseFuelClock('2026-10-25T02:30', zone, now, 1)?.toISOString(),
    ).toBe('2026-10-25T01:30:00.000Z');
    expect(
      parseFuelClock('2026-10-25T02:30', zone, now, 2)?.toISOString(),
    ).toBe('2026-10-25T00:30:00.000Z');
  });
  it.each(['04.11.2026 12:34', 'Date: 2026-11-04 Time: 12:34'])(
    'reads an unambiguous invoice timestamp: %s',
    (text) => {
      expect(receiptClock(text, zone, now)).toBe('2026-11-04T12:34');
    },
  );
  it('does not turn a price, partial clock or conflicting invoice times into a guessed fueling time', () => {
    for (const text of [
      'TOTAL 12:34 ALL',
      '04.11.2026',
      '04.11.2026 12:34\n04.11.2026 13:45',
    ])
      expect(receiptClock(text, zone, now)).toBeNull();
  });
  it('preserves seconds printed on the receipt', () => {
    expect(receiptClock('04/11/2026 Ora: 12:34:15', zone, now)).toBe(
      '2026-11-04T12:34:15',
    );
    expect(
      parseFuelClock('2026-11-04T12:34:15', zone, now)?.toISOString(),
    ).toBe('2026-11-04T11:34:15.000Z');
  });
  it('preserves the original GPS time and signed transmission gap without interpolation', () => {
    const points = [
      {
        lat: 41.2,
        lng: 19.7,
        recordedAt: '2026-11-04T11:32:00Z',
        source: 'wanway_history',
      },
      {
        lat: 41.3,
        lng: 19.8,
        recordedAt: '2026-11-04T11:35:00Z',
        source: 'wanway_history',
      },
    ];
    const result = closestFuelEvidence(
      points,
      new Date('2026-11-04T11:34Z'),
      now,
    )!;
    expect(result).toMatchObject({
      lat: 41.3,
      recordedAt: '2026-11-04T11:35:00Z',
      deltaSeconds: 60,
      status: 'matched',
      source: 'wanway_history',
    });
    expect(result.evidence).toHaveLength(2);
    expect(
      closestFuelEvidence([points[0]], new Date('2026-11-04T13:00Z'), now)
        ?.status,
    ).toBe('too_far');
    expect(
      closestFuelEvidence(
        [
          { ...points[0], lat: NaN },
          { ...points[0], recordedAt: '2026-11-05T00:00Z' },
        ],
        now,
        now,
      ),
    ).toBeNull();
  });
  it('bounds receipt image dimensions and rejects renamed non-image payloads', async () => {
    const bytes = new Uint8Array(
      await readFile('tests/fixtures/synthetic-fuel-receipt.png'),
    );
    expect(receiptImage(bytes)).toBe('image/png');
    const bomb = Buffer.from(bytes);
    bomb.writeUInt32BE(30000, 16);
    expect(receiptImage(bomb)).toBeNull();
    expect(receiptImage(Buffer.from('<svg onload="alert(1)">'))).toBeNull();
    expect(receiptImage(bytes.slice(0, 20))).toBeNull();
  });
  it.skipIf(process.platform !== 'linux')(
    'reads the synthetic receipt with the actual local OCR engine',
    async () => {
      const text = await readReceiptText(
        new Uint8Array(
          await readFile('tests/fixtures/synthetic-fuel-receipt.png'),
        ),
      );
      expect(receiptClock(text, zone, now)).toBe('2026-11-04T12:34');
    },
  );
  it('uses construction-site symbols in BauFlow and retains tree symbols for tree work', () => {
    for (const type of ['STEEL_ASSEMBLY', 'RENOVATION', 'OTHER', 'DRAINAGE'])
      expect(siteMapSymbol(type, true)).toBe('🏗️');
    expect(siteMapSymbol('CLIMBING', false, 80)).toBe('🌳');
  });
});
