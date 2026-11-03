import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  displayName,
  parseRosterDate,
  parseRosterInput,
  roleFor,
} from './roster-input';

const sample = {
  company: 'Shembull Steel shpk',
  retireSamples: true,
  workers: [
    [
      'office',
      'Ana',
      'Shembulli',
      '07.07.1998',
      'Inxhiniere ndertimi-Zbatim',
      'B',
      '',
      'j00000000a',
    ],
    ['factory', 'RAJ', 'KUMAR SINGH', '04.09.2003', 'Saldator', '', ''],
    [
      'field',
      'Besi',
      'Prova',
      '01.03.1984',
      'Punëtor për montimin e konstruksioneve',
      'B',
      'DAP',
    ],
    ['nowhere', 'X', 'Y', '', '', '', ''],
  ],
  machines: [
    [
      'Kamion me vinc',
      'AB 123 CD',
      'Volvo',
      'FH 16',
      'Shembull Steel',
      '32',
      '10.02.2027',
      '31.07.2027',
      '12.2026',
      '29.03.2027',
      '',
      '',
    ],
    [
      'Kamion me vinc',
      'AA 999 ZZ',
      'MAN',
      'TGS',
      'Huazuar shpk',
      '18',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    ['Platforma', '', '', '', '', '', '', '', '', '', '', ''],
  ],
};

describe('parseRosterInput', () => {
  it('reads gzipped base64 and plain JSON alike', () => {
    const zipped = gzipSync(Buffer.from(JSON.stringify(sample))).toString(
      'base64',
    );
    expect(parseRosterInput(zipped)).toEqual(
      parseRosterInput(JSON.stringify(sample)),
    );
    expect(parseRosterInput(undefined)).toBeNull();
    expect(() => parseRosterInput(JSON.stringify({ workers: [] }))).toThrow(
      /legal name/,
    );
  });

  it('reads optional sites and defaults unknown types to OTHER', () => {
    const roster = parseRosterInput(
      JSON.stringify({ company: 'X shpk', sites: [['Punishtja', 'STEEL_WORKSHOP', 'Rruga 1'], ['Kantier', 'weird', ''], ['', 'OTHER', '']] }),
    )!;
    expect(roster.sites).toEqual([
      { name: 'Punishtja', type: 'STEEL_WORKSHOP', address: 'Rruga 1' },
      { name: 'Kantier', type: 'OTHER', address: null },
    ]);
  });

  it('maps staff to roles, levels, licences and language', () => {
    const roster = parseRosterInput(JSON.stringify(sample))!;
    expect(roster.retireSamples).toBe(true);
    expect(roster.workers).toHaveLength(3);
    const [engineer, welder, fitter] = roster.workers;
    expect(engineer).toMatchObject({
      crewRole: 'FIELD_ENGINEER',
      level: 'VORARBEITER',
      language: 'SQ',
      licenses: 'B',
      nationalId: 'J00000000A',
    });
    expect(engineer?.birthDate?.toISOString().slice(0, 10)).toBe('1998-07-07');
    expect(welder).toMatchObject({
      firstName: 'Raj',
      lastName: 'Kumar Singh',
      crewRole: 'FACTORY_WORKER',
      language: 'EN',
      licenses: null,
      nationalId: null,
    });
    expect(fitter).toMatchObject({
      crewRole: 'FIELD_WORKER',
      licenses: 'B · DAP',
    });
  });

  it('maps the fleet with papers, owner and tonnage', () => {
    const [own, leased, platform] = parseRosterInput(
      JSON.stringify(sample),
    )!.machines;
    expect(own).toMatchObject({
      name: 'Volvo FH 16 · AB 123 CD',
      nickname: 'Volvo FH 16',
      category: 'TRUCK',
      ownership: null,
      tonnage: 32,
    });
    expect(own?.taxDate?.toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(own?.transportPermitDate?.toISOString().slice(0, 10)).toBe(
      '2027-03-29',
    );
    expect(leased?.ownership).toBe('Huazuar shpk');
    expect(platform).toMatchObject({
      name: 'Platforma',
      nickname: 'Platforma',
      category: 'AWP',
      targe: null,
      model: null,
    });
  });
});

describe('roster helpers', () => {
  it('title-cases names written in capitals only', () => {
    expect(displayName('KUMBALAMKALAM BIJU')).toBe('Kumbalamkalam Biju');
    expect(displayName('Mbriçe')).toBe('Mbriçe');
  });

  it('rejects impossible dates', () => {
    expect(parseRosterDate('31.02.2027')).toBeNull();
    expect(parseRosterDate('Ne dhjetor 2026')).toBeNull();
  });

  it('keeps cleaners without a crew role and makes office staff OFFICE', () => {
    expect(roleFor('office', 'Pastruese').crewRole).toBeNull();
    expect(roleFor('office', 'Ekonomiste').crewRole).toBe('OFFICE');
    expect(roleFor('factory', 'Inxhinier prodhimi')).toEqual({
      crewRole: 'FACTORY_ENGINEER',
      level: 'MEISTER',
    });
  });
});
