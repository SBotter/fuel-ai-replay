import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// MOCK MIDDLEWARE
// This completely overrides the parent folder's `src/middleware.ts` so that Next.js 
// does not accidentally apply production ProRefuel authentication to this standalone service.
export function middleware(request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: [],
}
