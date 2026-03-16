# ProRefuel Replay Service

Standalone Next.js service for `replay.prorefuel.app`.

This service is intentionally **visual only**.

- **ProRefuel core** remains the source of truth for athlete profile, Strava sync, activity processing, physiology, fueling logic, and meal engine.
- **Replay service** receives a prepared payload and renders an interactive 3D analysis experience.

## Production architecture

### Recommended runtime flow

1. ProRefuel activity card shows an **Open Replay** action.
2. ProRefuel exposes an authenticated endpoint that returns a **ReplayPayload JSON** for one activity.
3. The link opens:

```txt
https://replay.prorefuel.app/r?source=<url-encoded-prorefuel-endpoint>
```

4. Replay fetches the payload server-side and renders the experience.

### Why this boundary is good

- No nutrition rules duplicated inside replay.
- Replay does not need direct database access to the ProRefuel core.
- ProRefuel controls the contract and all physiological calculations.
- Replay can evolve visually without touching the meal or training engines.

## Install

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

## Required environment variables

### `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
Used for terrain, 3D camera, and route rendering.

### `REPLAY_SHARED_SECRET`
Optional. If set, replay sends it as `x-replay-shared-secret` when fetching the payload from ProRefuel.
This is useful when ProRefuel wants to verify that requests really come from the replay service.

## Included routes

### Viewer

```txt
GET /r?source=<url>
```

Optional query params:

- `token`: passed as `Authorization: Bearer <token>` to the source endpoint.
- `payload`: base64url-encoded payload for local debugging only.

### Example payload

```txt
GET /api/replays/example
```

### Validation + normalization

```txt
POST /api/replays/normalize
```

Request body: `ReplayPayload`

Response: normalized replay model used by the viewer.

## Exact payload contract

This service expects the following top-level shape.
The source-of-truth TypeScript schema is in `src/lib/replay-payload.ts`.

```ts
export type ReplayPayload = {
  version: string;
  activity: {
    id: string;
    stravaActivityId?: string | number;
    name: string;
    sportType: string;
    type?: string;
    startDate: string;
    timezone?: string;
    distanceM: number;
    movingTimeS: number;
    elapsedTimeS: number;
    elevationGainM: number;
    averageSpeedMps?: number;
    maxSpeedMps?: number;
    averageHeartRateBpm?: number;
    maxHeartRateBpm?: number;
    routePolyline?: string;
  };
  athlete?: {
    id?: string;
    weightKg?: number;
    sports?: string[];
    goalPhase?: string;
    timezone?: string;
  };
  physiology?: {
    energyKcal?: number;
    glycogenDepletionGrams?: number;
    cnsFatigueScore?: number;
    muscleDamageIndex?: string;
  };
  display: {
    defaultMode: 'speed' | 'grade' | 'effort' | 'fuelRisk' | 'glycogenRemaining' | 'heartRate';
    availableModes: Array<'speed' | 'grade' | 'effort' | 'fuelRisk' | 'glycogenRemaining' | 'heartRate'>;
    units: 'metric' | 'imperial';
    initialPitch: number;
    initialBearing: number;
    initialZoom: number;
  };
  samples?: Array<{
    idx?: number;
    elapsedS: number;
    distanceM: number;
    lat: number;
    lon: number;
    elevationM: number;
    speedMps: number;
    gradePct: number;
    effortScore: number;      // 0..1, already computed by ProRefuel
    fuelRisk: number;         // 0..1, already computed by ProRefuel
    glycogenRemainingG?: number;
    heartRateBpm?: number;
    cadenceRpm?: number;
    powerWatts?: number;
  }>;
  segments: Array<{
    id: string;
    type: string;
    title: string;
    startIdx: number;
    endIdx: number;
    severity: 'info' | 'warning' | 'critical';
    summary?: string;
    metrics: Record<string, number | string | boolean>;
  }>;
  insights: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    sampleIdx?: number;
    segmentId?: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  source?: {
    kind: 'inline' | 'prorefuel-endpoint';
    sourceUrl?: string;
  };
};
```

## Important contract rule

Replay should **not** recalculate business logic.

Replay expects ProRefuel to send:

- `effortScore`
- `fuelRisk`
- `glycogenRemainingG` when available
- `segments`
- `insights`

Replay may derive only **visual state**, such as:

- route colors
- chart shapes
- camera movement
- current marker position

## What ProRefuel should compute before calling replay

At minimum, ProRefuel should prepare:

- normalized activity summary
- point samples along the activity
- terrain/effort/fuel overlays by sample
- segment detection
- insight text

## Recommended ProRefuel endpoint

Example:

```txt
GET /api/replay-payload/:activityId
```

This endpoint should return exactly a `ReplayPayload`.

Suggested auth options:

- Supabase session checked by ProRefuel
- a short-lived signed token passed in query or bearer header
- optional `x-replay-shared-secret` validation on the ProRefuel side

## Recommended card integration

Add a secondary action on the activity card, for example:

- `Open Replay`
- `View Fuel Map`
- `Analyze Route`

Then build the URL:

```ts
const replayUrl = `https://replay.prorefuel.app/r?source=${encodeURIComponent(
  `${PROREFUEL_ORIGIN}/api/replay-payload/${activityId}`
)}`;
```

If ProRefuel needs stricter auth:

```ts
const replayUrl = `https://replay.prorefuel.app/r?source=${encodeURIComponent(sourceUrl)}&token=${signedReplayToken}`;
```

## Example payload in this repo

- `public/examples/seymour-replay-payload.json`
- `GET /api/replays/example`

## Current viewer capabilities

- 3D Mapbox terrain
- timeline scrubber
- autoplay
- auto-follow camera
- overlay color modes
- metric cards
- sparklines for elevation, speed, and fuel risk
- hotspot jump list
- insight panel

## Recommended next steps after plugging into ProRefuel

1. Build `GET /api/replay-payload/:activityId` in ProRefuel.
2. Return the exact contract above.
3. Add the replay action to the existing activity card.
4. Deploy this service to Vercel as `replay.prorefuel.app`.
5. Refine camera choreography and themes after the first end-to-end test.
