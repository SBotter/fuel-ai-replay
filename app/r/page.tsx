import { ReplayViewer } from '@/components/replay-viewer';
import { ReplayPayloadSchema, type ReplayPayload } from '@/lib/replay-payload';
 
export const dynamic = 'force-dynamic';

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
  try {
    const payload = await loadPayload(searchParams);
    return <ReplayViewer payload={payload} />;
  } catch (error: any) {
    console.error('[Replay Page] Rendering Error:', error);
    
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950 text-white">
        <div className="max-w-2xl w-full border border-red-500/50 bg-red-500/10 p-6 rounded-xl space-y-4">
          <h1 className="text-2xl font-black uppercase italic text-red-500">Replay Service Error</h1>
          <p className="text-slate-400 font-medium">
            We encountered an issue while loading the activity data. This is usually due to a mismatch between the Core App data and the Replay Viewer schema.
          </p>
          <div className="bg-black/50 p-4 rounded font-mono text-xs overflow-auto max-h-64 border border-white/10">
            <span className="text-red-400 font-bold">{String(error.name || 'Error')}:</span> {error.message}
            {error.issues && (
              <pre className="mt-2 text-blue-400">
                {JSON.stringify(error.issues, null, 2)}
              </pre>
            )}
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold pt-4">
            Try refreshing the dashboard and opening the replay again.
          </p>
        </div>
      </div>
    );
  }
}
