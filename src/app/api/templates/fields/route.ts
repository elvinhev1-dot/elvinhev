import { NextRequest, NextResponse } from 'next/server';
import { getTemplate } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * GET /api/templates/fields?id=<templateId>
 * Returns the field schema (labels, placeholders, input types) the
 * frontend uses to build the dynamic form for a given template.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing required "id" query parameter.' }, { status: 400 });
  }

  const template = getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found. It may have been deleted.' }, { status: 404 });
  }

  return NextResponse.json({ template });
}
