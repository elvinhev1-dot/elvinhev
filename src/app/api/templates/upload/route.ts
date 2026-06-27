import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  tagTemplate,
  detectExistingPlaceholders,
  normalizeSplitPlaceholders,
  DetectedField,
} from '@/lib/docxEngine';
import { defaultRules, placeholderId } from '@/lib/defaultRules';

export const runtime = 'nodejs';

/**
 * POST /api/templates/upload
 * Accepts multipart/form-data with a "file" field containing a .docx.
 * Returns the processed template with base64-encoded docx content.
 * No filesystem storage — fully stateless for Vercel/serverless deployment.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || file?.name || 'Untitled template';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded. Please attach a .docx file.' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .docx files are supported.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty.' }, { status: 400 });
    }
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 400 });
    }

    const isZip = buffer.slice(0, 2).toString('hex') === '504b';
    if (!isZip) {
      return NextResponse.json(
        { error: 'This does not look like a valid .docx file.' },
        { status: 400 }
      );
    }

    const existingTags = detectExistingPlaceholders(buffer);

    let finalBuffer: Buffer;
    let detected: DetectedField[];

    if (existingTags.length > 0) {
      finalBuffer = normalizeSplitPlaceholders(buffer);
      detected = existingTags.map((tag) => {
        const known = defaultRules.find((r) => placeholderId(r.placeholder) === tag);
        return (
          known && {
            id: known.id,
            label: known.label,
            placeholder: known.placeholder,
            inputType: known.inputType || 'text',
            example: known.example,
            required: known.required ?? true,
            occurrences: 1,
          }
        ) ||
          ({
            id: tag,
            label: tag
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            placeholder: `{{${tag}}}`,
            inputType: 'text',
            example: undefined,
            required: true,
            occurrences: 1,
          } as DetectedField);
      });
    } else {
      const result = await tagTemplate(buffer, defaultRules);
      finalBuffer = result.buffer;
      detected = result.detected;

      if (detected.length === 0) {
        return NextResponse.json(
          {
            error:
              'No known placeholders or recognizable contract fields were found in this document. ' +
              'You can still use it, but no fields could be auto-detected — try a template that already ' +
              'contains {{placeholders}}, or use the sample SR TEXNO contract structure.',
          },
          { status: 422 }
        );
      }
    }

    const id = uuidv4();
    const docxBase64 = finalBuffer.toString('base64');

    const template = {
      id,
      name,
      originalFilename: file.name,
      createdAt: new Date().toISOString(),
      fields: detected,
      docxBase64,
    };

    return NextResponse.json({ template }, { status: 201 });
  } catch (err: any) {
    console.error('Template upload failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process the uploaded document.' },
      { status: 500 }
    );
  }
}
