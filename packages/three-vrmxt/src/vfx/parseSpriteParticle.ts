export const EXT_SPRITE_PARTICLE = 'VRMXT_sprite_particle';
export const SPRITE_PARTICLE_SPEC_VERSION = '1.0';

export const DEFAULT_SIZE: [number, number] = [0.05, 0.05];
export const DEFAULT_COLOR: [number, number, number, number] = [1, 1, 1, 1];
export const DEFAULT_EMISSION_RATE = 10;
export const DEFAULT_MAX_PARTICLES = 64;
export const DEFAULT_LIFETIME = 1;
export const DEFAULT_START_SPEED = 0.1;

export type SpriteParticleEmitter = {
  node: number;
  name?: string;
  texture?: number;
  size: [number, number];
  color: [number, number, number, number];
  emissionRate: number;
  maxParticles: number;
  lifetime: number;
  startSpeed: number;
};

export type SpriteParticleExtension = {
  specVersion: typeof SPRITE_PARTICLE_SPEC_VERSION;
  emitters: SpriteParticleEmitter[];
};

export type ParseSpriteParticleOptions = {
  nodeCount?: number;
  textureCount?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSize(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 2) {
    return null;
  }
  const w = raw[0];
  const h = raw[1];
  if (!isFiniteNumber(w) || !isFiniteNumber(h) || w <= 0 || h <= 0) {
    return null;
  }
  return [w, h];
}

function parseColor(raw: unknown): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4) {
    return null;
  }
  const r = raw[0];
  const g = raw[1];
  const b = raw[2];
  const a = raw[3];
  if (!isFiniteNumber(r) || !isFiniteNumber(g) || !isFiniteNumber(b) || !isFiniteNumber(a)) {
    return null;
  }
  if (r < 0 || g < 0 || b < 0 || a < 0 || a > 1) {
    return null;
  }
  return [r, g, b, a];
}

function parseNonNeg(raw: unknown, fallback: number): number | null {
  if (raw === undefined) {
    return fallback;
  }
  if (!isFiniteNumber(raw) || raw < 0) {
    return null;
  }
  return raw;
}

function extensionObject(json: unknown): Record<string, unknown> | null {
  if (!isRecord(json)) {
    return null;
  }
  if (isRecord(json.extensions) && isRecord(json.extensions[EXT_SPRITE_PARTICLE])) {
    return json.extensions[EXT_SPRITE_PARTICLE];
  }
  if (isRecord(json[EXT_SPRITE_PARTICLE])) {
    return json[EXT_SPRITE_PARTICLE];
  }
  if (typeof json.specVersion === 'string' && Array.isArray(json.emitters)) {
    return json;
  }
  return null;
}

function parseEmitter(
  raw: unknown,
  opts: ParseSpriteParticleOptions,
): SpriteParticleEmitter | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (!isInt(raw.node) || raw.node < 0) {
    return null;
  }
  if (opts.nodeCount !== undefined && raw.node >= opts.nodeCount) {
    return null;
  }

  let texture: number | undefined;
  if (raw.texture !== undefined) {
    if (!isInt(raw.texture) || raw.texture < 0) {
      return null;
    }
    if (opts.textureCount !== undefined && raw.texture >= opts.textureCount) {
      return null;
    }
    texture = raw.texture;
  }

  const size = raw.size === undefined ? DEFAULT_SIZE : parseSize(raw.size);
  if (size === null) {
    return null;
  }
  const color = raw.color === undefined ? DEFAULT_COLOR : parseColor(raw.color);
  if (color === null) {
    return null;
  }
  const emissionRate = parseNonNeg(raw.emissionRate, DEFAULT_EMISSION_RATE);
  const lifetime = parseNonNeg(raw.lifetime, DEFAULT_LIFETIME);
  const startSpeed = parseNonNeg(raw.startSpeed, DEFAULT_START_SPEED);
  if (emissionRate === null || lifetime === null || startSpeed === null) {
    return null;
  }

  let maxParticles = DEFAULT_MAX_PARTICLES;
  if (raw.maxParticles !== undefined) {
    if (!isInt(raw.maxParticles) || raw.maxParticles < 1) {
      return null;
    }
    maxParticles = raw.maxParticles;
  }

  const emitter: SpriteParticleEmitter = {
    node: raw.node,
    size,
    color,
    emissionRate,
    maxParticles,
    lifetime,
    startSpeed,
  };
  if (typeof raw.name === 'string') {
    emitter.name = raw.name;
  }
  if (texture !== undefined) {
    emitter.texture = texture;
  }
  return emitter;
}

/**
 * Parse / validate `VRMXT_sprite_particle`. Invalid emitters are dropped.
 * Unknown or missing specVersion: null (skip the extra).
 */
export function parseSpriteParticle(
  json: unknown,
  opts: ParseSpriteParticleOptions = {},
): SpriteParticleExtension | null {
  const ext = extensionObject(json);
  if (!ext) {
    return null;
  }
  if (ext.specVersion !== SPRITE_PARTICLE_SPEC_VERSION) {
    return null;
  }
  if (!Array.isArray(ext.emitters)) {
    return null;
  }
  const emitters: SpriteParticleEmitter[] = [];
  for (const item of ext.emitters) {
    const emitter = parseEmitter(item, opts);
    if (emitter) {
      emitters.push(emitter);
    }
  }
  return { specVersion: SPRITE_PARTICLE_SPEC_VERSION, emitters };
}

export function spriteParticleRawCount(json: unknown): number {
  const ext = extensionObject(json);
  if (!ext || !Array.isArray(ext.emitters)) {
    return 0;
  }
  return ext.emitters.length;
}
