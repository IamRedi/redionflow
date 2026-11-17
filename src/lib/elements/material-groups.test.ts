import { describe, expect, it } from 'vitest';
import { materialGroup, readAssemblyParts } from './material-groups';

describe('material group boundaries', () => {
  it('keeps old imported rows as assemblies and distinguishes manual elements without changing list semantics', () => {
    expect(materialGroup({ list: 'assembly' })).toBe('assembly');
    expect(materialGroup({ list: 'assembly', isManual: true })).toBe('manual');
    expect(materialGroup({ list: 'part' })).toBe('part');
  });
  it('accepts exported references without folding code case and rejects malformed stored compositions', () => {
    const value = { v: 1, parts: [{ mark: 'B/1', quantity: 1 }, { mark: 'b/1', quantity: 2 }] };
    expect(readAssemblyParts(value)).toEqual(value);
    for (const parts of [[{ mark: '', quantity: 1 }], [{ mark: 'a', quantity: -1 }], [{ mark: 'a', quantity: 1.5 }], [null]]) expect(readAssemblyParts({ v: 1, parts })).toBeNull();
    expect(readAssemblyParts({ v: 2, parts: [] })).toBeNull();
    expect(readAssemblyParts(null)).toBeNull();
  });
});
