const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export type GlbParts = {
  json: unknown;
  bin: Uint8Array | null;
};

function pad4(n: number): number {
  return (4 - (n % 4)) % 4;
}

export function isGlb(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) {
    return false;
  }
  const view = new DataView(bytes);
  return view.getUint32(0, true) === GLB_MAGIC && view.getUint32(4, true) === GLB_VERSION;
}

export function parseGlb(bytes: ArrayBuffer): GlbParts | null {
  if (!isGlb(bytes)) {
    return null;
  }
  const view = new DataView(bytes);
  const total = view.getUint32(8, true);
  if (total > bytes.byteLength) {
    return null;
  }
  let offset = 12;
  let json: unknown = null;
  let bin: Uint8Array | null = null;
  while (offset + 8 <= total) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > total) {
      return null;
    }
    if (chunkType === CHUNK_JSON) {
      const text = new TextDecoder().decode(new Uint8Array(bytes, start, chunkLength));
      try {
        json = JSON.parse(text);
      } catch {
        return null;
      }
    } else if (chunkType === CHUNK_BIN) {
      bin = new Uint8Array(bytes.slice(start, end));
    }
    offset = end;
  }
  if (json === null) {
    return null;
  }
  return { json, bin };
}

export function buildGlb(json: unknown, bin: Uint8Array | null): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = pad4(jsonBytes.length);
  const jsonChunk = jsonBytes.length + jsonPad;
  const hasBin = bin !== null && bin.byteLength > 0;
  const binPad = hasBin ? pad4(bin!.byteLength) : 0;
  const binChunk = hasBin ? bin!.byteLength + binPad : 0;
  const total = 12 + 8 + jsonChunk + (hasBin ? 8 + binChunk : 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk, true);
  view.setUint32(16, CHUNK_JSON, true);
  bytes.set(jsonBytes, 20);
  bytes.fill(0x20, 20 + jsonBytes.length, 20 + jsonChunk);
  if (!hasBin) {
    return out;
  }
  const binHeader = 20 + jsonChunk;
  view.setUint32(binHeader, binChunk, true);
  view.setUint32(binHeader + 4, CHUNK_BIN, true);
  bytes.set(bin!, binHeader + 8);
  bytes.fill(0, binHeader + 8 + bin!.byteLength, binHeader + 8 + binChunk);
  return out;
}
