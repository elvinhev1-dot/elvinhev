import { NextRequest, NextResponse } from 'next/server';
import { renderDocument } from '@/lib/docxEngine';
import { placeholderId } from '@/lib/defaultRules';
import { DetectedFieldDTO } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/generate
 * Body: { docxBase64: string, fields: DetectedFieldDTO[], name: string, values: Record<string, string> }
 *
 * Fully stateless — the client sends the template docx as base64,
 * server renders it and streams back the filled .docx.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { docxBase64, fields, name, values } = body as {
      docxBase64?: string;
      fields?: DetectedFieldDTO[];
      name?: string;
      values?: Record<string, string>;
    };

    if (!docxBase64) {
      return NextResponse.json({ error: 'Missing docxBase64.' }, { status: 400 });
    }
    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json({ error: 'Missing fields array.' }, { status: 400 });
    }

    // Validate required fields
    const missing = fields
      .filter((f) => f.required)
      .filter((f) => !values || !String(values[f.id] ?? '').trim());

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required field(s): ${missing.map((f) => f.label).join(', ')}.`,
          missingFields: missing.map((f) => f.id),
        },
        { status: 400 }
      );
    }

    // Build data map for docxtemplater
    const data: Record<string, string> = {};
    for (const field of fields) {
      const key = placeholderId(field.placeholder);
      data[key] = values?.[field.id] != null ? String(values[field.id]) : '';
    }

    const templateBuffer = Buffer.from(docxBase64, 'base64');
    const outputBuffer = renderDocument(templateBuffer, data);

    const safeName = (name || 'contract').replace(/[^a-z0-9_\-]+/gi, '_');
    const filename = `${safeName}_${Date.now()}.docx`;

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(outputBuffer.length),
      },
    });
  } catch (err: any) {
    console.error('Document generation failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate the document. Please check your inputs and try again.' },
      { status: 500 }
    );
  }
}
