import { NextResponse } from 'next/server';
import { normalizeReplayPayload } from '@/lib/normalize';
import { ReplayPayloadSchema } from '@/lib/replay-payload';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = ReplayPayloadSchema.parse(body);
    const model = normalizeReplayPayload(payload);
    return NextResponse.json({ ok: true, model });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Replay payload validation failed.',
      },
      { status: 400 },
    );
  }
}
