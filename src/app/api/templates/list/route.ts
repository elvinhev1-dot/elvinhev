import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/templates/list
 * In the stateless version, templates are stored client-side.
 * This endpoint returns an empty list — the client manages its own template state.
 */
export async function GET() {
  return NextResponse.json({ templates: [] });
}
