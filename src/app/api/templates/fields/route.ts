import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/templates/fields?id=<templateId>
 * In the stateless version, templates (including their field schemas)
 * are stored client-side in localStorage. This endpoint is kept for
 * API compatibility but returns 404 — the frontend no longer calls it.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing required "id" query parameter.' }, { status: 400 });
  }
  return NextResponse.json(
    { error: 'Template not found. Templates are managed client-side in this deployment.' },
    { status: 404 }
  );
}
