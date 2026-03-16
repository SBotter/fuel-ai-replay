import { ReplayViewer } from '@/components/replay-viewer';
import { ReplayPayloadSchema, type ReplayPayload } from '@/lib/replay-payload';

async function loadPayload(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<ReplayPayload> {
  const params = await searchParams;
  const source = typeof params.source === 'string' ? params.source : undefined;
  const payloadParam = typeof params.payload === 'string' ? params.payload : undefined;
  const bearer = typeof params.token === 'string' ? params.token : undefined;

  if (payloadParam) {
    const decoded = JSON.parse(Buffer.from(payloadParam, 'base64url').toString('utf8'));
    return ReplayPayloadSchema.parse(decoded);
  }

  if (!source) {
    throw new Error('Missing `source` query parameter.');
  }

  const response = await fetch(source, {
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(process.env.REPLAY_SHARED_SECRET ? { 'x-replay-shared-secret': process.env.REPLAY_SHARED_SECRET } : {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Replay source request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return ReplayPayloadSchema.parse(payload);
}

export default async function ReplayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const payload = await loadPayload(searchParams);
  return <ReplayViewer payload={payload} />;
}
