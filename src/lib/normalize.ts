import { ReplayMode, ReplayPayload, ReplaySample, ensureSamples } from '@/lib/replay-payload';

export type NormalizedReplayPoint = ReplaySample & {
  progress: number;
  colorSpeed: string;
  colorGrade: string;
  colorEffort: string;
  colorFuelRisk: string;
  colorGlycogenRemaining: string;
  colorHeartRate: string;
};

export type NormalizedReplayModel = {
  payload: ReplayPayload;
  points: NormalizedReplayPoint[];
  bounds: [[number, number], [number, number]];
  stats: {
    maxElevationM: number;
    minElevationM: number;
    maxSpeedMps: number;
    minSpeedMps: number;
    maxGradePct: number;
    minGradePct: number;
    maxFuelRisk: number;
    minFuelRisk: number;
    maxHeartRateBpm?: number;
    maxDistanceM: number;
  };
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blend(stops: [number, [number, number, number]][], value: number): string {
  const t = clamp01(value);
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [aPos, aRgb] = stops[i];
    const [bPos, bRgb] = stops[i + 1];
    if (t >= aPos && t <= bPos) {
      const local = (t - aPos) / (bPos - aPos || 1);
      return rgb(
        lerp(aRgb[0], bRgb[0], local),
        lerp(aRgb[1], bRgb[1], local),
        lerp(aRgb[2], bRgb[2], local),
      );
    }
  }
  return rgb(...stops[stops.length - 1][1]);
}

export function getModeColor(point: NormalizedReplayPoint, mode: ReplayMode): string {
  switch (mode) {
    case 'speed':
      return point.colorSpeed;
    case 'grade':
      return point.colorGrade;
    case 'effort':
      return point.colorEffort;
    case 'fuelRisk':
      return point.colorFuelRisk;
    case 'glycogenRemaining':
      return point.colorGlycogenRemaining;
    case 'heartRate':
      return point.colorHeartRate;
    default:
      return point.colorFuelRisk;
  }
}

export function normalizeReplayPayload(payload: ReplayPayload): NormalizedReplayModel {
  const samples = ensureSamples(payload).sort((a, b) => a.elapsedS - b.elapsedS);

  const maxSpeed = Math.max(...samples.map((s) => s.speedMps ?? 0), 1);
  const grades = samples.map((s) => s.gradePct ?? 0);
  const maxGrade = Math.max(...grades, 1);
  const minGrade = Math.min(...grades, -1);
  const maxFuelRisk = Math.max(...samples.map((s) => s.fuelRisk ?? 0), 1);
  const minFuelRisk = Math.min(...samples.map((s) => s.fuelRisk ?? 0), 0);
  const maxHeartRate = Math.max(...samples.map((s) => s.heartRateBpm ?? 0), 0);
  const maxDistance = Math.max(...samples.map((s) => s.distanceM ?? 0), payload.activity.distanceM, 1);
  const elevations = samples.map((s) => s.elevationM ?? 0);
  const maxElevation = Math.max(...elevations, 0);
  const minElevation = Math.min(...elevations, 0);

  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;

  const points: NormalizedReplayPoint[] = samples.map((sample, idx) => {
    minLat = Math.min(minLat, sample.lat);
    maxLat = Math.max(maxLat, sample.lat);
    minLon = Math.min(minLon, sample.lon);
    maxLon = Math.max(maxLon, sample.lon);

    const speedT = clamp01((sample.speedMps ?? 0) / maxSpeed);
    const effortT = clamp01(sample.effortScore ?? 0);
    const fuelT = clamp01((sample.fuelRisk - minFuelRisk) / ((maxFuelRisk - minFuelRisk) || 1));
    const glycogenT = clamp01(1 - ((sample.glycogenRemainingG ?? 0) / Math.max(...samples.map((s) => s.glycogenRemainingG ?? 0), 1)));
    const heartT = maxHeartRate > 0 ? clamp01((sample.heartRateBpm ?? 0) / maxHeartRate) : 0;

    const gradeValue = sample.gradePct ?? 0;
    const gradeT = gradeValue >= 0
      ? 0.5 + 0.5 * clamp01(gradeValue / (maxGrade || 1))
      : 0.5 - 0.5 * clamp01(Math.abs(gradeValue) / (Math.abs(minGrade) || 1));

    return {
      ...sample,
      idx,
      progress: clamp01((sample.distanceM ?? idx) / maxDistance),
      colorSpeed: blend([
        [0, [14, 77, 147]],
        [0.5, [59, 130, 246]],
        [1, [255, 255, 255]],
      ], speedT),
      colorGrade: blend([
        [0, [37, 99, 235]],
        [0.5, [34, 197, 94]],
        [0.75, [245, 158, 11]],
        [1, [239, 68, 68]],
      ], gradeT),
      colorEffort: blend([
        [0, [16, 185, 129]],
        [0.5, [234, 179, 8]],
        [1, [239, 68, 68]],
      ], effortT),
      colorFuelRisk: blend([
        [0, [34, 197, 94]],
        [0.5, [245, 158, 11]],
        [1, [239, 68, 68]],
      ], fuelT),
      colorGlycogenRemaining: blend([
        [0, [34, 197, 94]],
        [0.5, [56, 189, 248]],
        [1, [236, 72, 153]],
      ], glycogenT),
      colorHeartRate: blend([
        [0, [59, 130, 246]],
        [0.6, [250, 204, 21]],
        [1, [239, 68, 68]],
      ], heartT),
    };
  });

  return {
    payload,
    points,
    bounds: [[minLon, minLat], [maxLon, maxLat]],
    stats: {
      maxElevationM: payload.activity.maxElevationM ?? maxElevation,
      minElevationM: minElevation,
      maxSpeedMps: payload.activity.maxSpeedMps ?? maxSpeed,
      minSpeedMps: Math.min(...samples.map((s) => s.speedMps ?? 0)),
      maxGradePct: maxGrade,
      minGradePct: minGrade,
      maxFuelRisk,
      minFuelRisk,
      maxHeartRateBpm: maxHeartRate || undefined,
      maxDistanceM: maxDistance,
    },
  };
}
