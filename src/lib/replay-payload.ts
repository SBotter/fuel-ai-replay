import polyline from '@mapbox/polyline';
import { z } from 'zod';

export const ReplayModeSchema = z.enum([
  'speed',
  'grade',
  'effort',
  'fuelRisk',
  'glycogenRemaining',
  'heartRate',
]);

export type ReplayMode = z.infer<typeof ReplayModeSchema>;

export const ReplaySampleSchema = z.object({
  idx: z.number().int().nonnegative().optional(),
  elapsedS: z.number().nonnegative(),
  distanceM: z.number().nonnegative(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationM: z.number(),
  speedMps: z.number().nonnegative().default(0),
  gradePct: z.number().default(0),
  effortScore: z.number().min(0).max(1).default(0),
  fuelRisk: z.number().min(0).max(1).default(0),
  glycogenRemainingG: z.number().nonnegative().optional(),
  heartRateBpm: z.number().positive().optional(),
  cadenceRpm: z.number().nonnegative().optional(),
  powerWatts: z.number().nonnegative().optional(),
  isPeak: z.boolean().optional(),
  isLowest: z.boolean().optional(),
});

export const ReplaySegmentSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  startIdx: z.number().int().nonnegative(),
  endIdx: z.number().int().nonnegative(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  summary: z.string().optional(),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export const ReplayInsightSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  sampleIdx: z.number().int().nonnegative().optional(),
  segmentId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
});

export const ReplayPayloadSchema = z.object({
  version: z.string().default('1.0'),
  activity: z.object({
    id: z.string(),
    stravaActivityId: z.union([z.string(), z.number()]).optional(),
    name: z.string(),
    sportType: z.string(),
    type: z.string().optional(),
    startDate: z.string(),
    timezone: z.string().optional(),
    distanceM: z.number().nonnegative(),
    movingTimeS: z.number().int().nonnegative(),
    elapsedTimeS: z.number().int().nonnegative(),
    elevationGainM: z.number().nonnegative(),
    averageSpeedMps: z.number().nonnegative().optional(),
    maxSpeedMps: z.number().nonnegative().optional(),
    averageHeartRateBpm: z.number().positive().optional(),
    maxHeartRateBpm: z.number().positive().optional(),
    routePolyline: z.string().optional(),
    maxElevationM: z.number().nonnegative().optional(),
  }),
  athlete: z.object({
    id: z.string().optional(),
    weightKg: z.number().positive().optional(),
    sports: z.array(z.string()).optional(),
    goalPhase: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
  physiology: z.object({
    energyKcal: z.number().nonnegative().optional(),
    glycogenDepletionGrams: z.number().nonnegative().optional(),
    cnsFatigueScore: z.number().nonnegative().optional(),
    muscleDamageIndex: z.string().optional(),
  }).optional(),
  display: z.object({
    defaultMode: ReplayModeSchema.default('fuelRisk'),
    availableModes: z.array(ReplayModeSchema).default(['speed', 'grade', 'effort', 'fuelRisk']),
    units: z.enum(['metric', 'imperial']).default('metric'),
    initialPitch: z.number().min(0).max(85).default(60),
    initialBearing: z.number().min(-360).max(360).default(0),
    initialZoom: z.number().min(0).max(22).default(12.5),
  }).default({
    defaultMode: 'fuelRisk',
    availableModes: ['speed', 'grade', 'effort', 'fuelRisk'],
    units: 'metric',
    initialPitch: 60,
    initialBearing: 0,
    initialZoom: 12.5,
  }),
  samples: z.array(ReplaySampleSchema).optional(),
  segments: z.array(ReplaySegmentSchema).default([]),
  insights: z.array(ReplayInsightSchema).default([]),
  source: z.object({
    kind: z.enum(['inline', 'prorefuel-endpoint']).default('inline'),
    sourceUrl: z.string().url().optional(),
  }).optional(),
});

export type ReplaySample = z.infer<typeof ReplaySampleSchema>;
export type ReplaySegment = z.infer<typeof ReplaySegmentSchema>;
export type ReplayInsight = z.infer<typeof ReplayInsightSchema>;
export type ReplayPayload = z.infer<typeof ReplayPayloadSchema>;

export function decodePolylineToSamples(routePolyline: string): ReplaySample[] {
  const coords = polyline.decode(routePolyline);
  return coords.map(([lat, lon], idx) => ({
    idx,
    elapsedS: idx,
    distanceM: idx,
    lat,
    lon,
    elevationM: 0,
    speedMps: 0,
    gradePct: 0,
    effortScore: 0,
    fuelRisk: 0,
  }));
}

export function ensureSamples(payload: ReplayPayload): ReplaySample[] {
  if (payload.samples && payload.samples.length > 1) {
    return payload.samples.map((sample, idx) => ({ ...sample, idx: sample.idx ?? idx }));
  }

  if (payload.activity.routePolyline) {
    return decodePolylineToSamples(payload.activity.routePolyline);
  }

  throw new Error('Replay payload requires either samples[] or activity.routePolyline.');
}
