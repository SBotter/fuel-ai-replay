import { NextResponse } from 'next/server';
import examplePayload from '@/../public/examples/seymour-replay-payload.json';

export async function GET() {
  return NextResponse.json(examplePayload);
}
