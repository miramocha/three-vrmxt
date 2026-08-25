import { describe, expect, it } from 'vitest';
import {
  assignStencilRefs,
  isUnresolvableBody,
  isUnresolvableOutline,
  parseStencilExtra,
  writerSetKey,
  type StencilExtra,
} from '../src/mtoonxt/stencilRefs.js';

describe('parseStencilExtra', () => {
  it('returns null for non-objects and bad ops', () => {
    expect(parseStencilExtra(null)).toBeNull();
    expect(parseStencilExtra('write')).toBeNull();
    expect(parseStencilExtra({ op: 'clip' })).toBeNull();
  });

  it('parses ops and optional materials', () => {
    expect(parseStencilExtra({ op: 'write' })).toEqual({ op: 'write', materials: undefined });
    expect(parseStencilExtra({ op: 'inside', materials: [0, 2] })).toEqual({
      op: 'inside',
      materials: [0, 2],
    });
  });

  it('rejects empty or non-integer materials', () => {
    expect(parseStencilExtra({ op: 'inside', materials: [] })).toBeNull();
    expect(parseStencilExtra({ op: 'inside', materials: [0.5] })).toBeNull();
    expect(parseStencilExtra({ op: 'inside', materials: [-1] })).toBeNull();
  });
});

describe('isUnresolvableBody', () => {
  const write: StencilExtra = { op: 'write' };
  const bodyOps: Array<StencilExtra | null> = [write, { op: 'inside', materials: [0] }];

  it('rejects same, write-with-materials, and missing writer list', () => {
    expect(isUnresolvableBody({ op: 'same' }, 2, bodyOps, 1)).toBe(true);
    expect(isUnresolvableBody({ op: 'write', materials: [0] }, 2, bodyOps, 0)).toBe(true);
    expect(isUnresolvableBody({ op: 'inside' }, 2, bodyOps, 1)).toBe(true);
  });

  it('rejects self, oob, or non-write targets', () => {
    expect(isUnresolvableBody({ op: 'inside', materials: [1] }, 2, bodyOps, 1)).toBe(true);
    expect(isUnresolvableBody({ op: 'inside', materials: [9] }, 2, bodyOps, 1)).toBe(true);
    expect(isUnresolvableBody({ op: 'inside', materials: [1] }, 2, bodyOps, 0)).toBe(true);
  });

  it('accepts inside listing a write material', () => {
    expect(isUnresolvableBody({ op: 'inside', materials: [0] }, 2, bodyOps, 1)).toBe(false);
  });
});

describe('isUnresolvableOutline', () => {
  const write: StencilExtra = { op: 'write' };
  const bodyOps: Array<StencilExtra | null> = [write, { op: 'inside', materials: [0] }];

  it('rejects same with materials or without body', () => {
    expect(isUnresolvableOutline({ op: 'same' }, write, 2, bodyOps, 0)).toBe(false);
    expect(isUnresolvableOutline({ op: 'same', materials: [0] }, write, 2, bodyOps, 0)).toBe(true);
    expect(isUnresolvableOutline({ op: 'same' }, null, 2, bodyOps, 0)).toBe(true);
  });

  it('rejects write-with-materials and missing writer list', () => {
    expect(isUnresolvableOutline({ op: 'write', materials: [0] }, write, 2, bodyOps, 0)).toBe(true);
    expect(isUnresolvableOutline({ op: 'outside' }, write, 2, bodyOps, 1)).toBe(true);
  });

  it('accepts outside listing a write material', () => {
    expect(isUnresolvableOutline({ op: 'outside', materials: [0] }, write, 2, bodyOps, 1)).toBe(
      false,
    );
  });
});

describe('assignStencilRefs / writerSetKey', () => {
  it('assigns stable refs per writer-index set', () => {
    const bodyOps: Array<StencilExtra | null> = [
      { op: 'write' },
      { op: 'inside', materials: [0] },
      { op: 'write' },
    ];
    const refs = assignStencilRefs(bodyOps);
    expect(refs.get('0')).toBe(1);
    expect(refs.get('2')).toBe(2);
    expect(writerSetKey({ op: 'write' }, 0)).toBe('0');
    expect(writerSetKey({ op: 'inside', materials: [0] }, 1)).toBe('0');
  });
});
