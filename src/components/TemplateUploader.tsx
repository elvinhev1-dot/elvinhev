'use client';

import { useCallback, useRef, useState } from 'react';
import { TemplateDTO } from '@/lib/types';

interface TemplateUploaderProps {
  onUploaded: (template: TemplateDTO) => void;
}

export default function TemplateUploader({ onUploaded }: TemplateUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Only .docx files are supported. Please export your contract as Word (.docx) and try again.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('That file is larger than 25MB. Please upload a smaller document.');
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', file.name.replace(/\.docx$/i, ''));

      const res = await fetch('/api/templates/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong while processing the document.');
      }

      onUploaded(data.template as TemplateDTO);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [onUploaded]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className={[
          'group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200',
          isDragging
            ? 'border-seal-600 bg-seal-50/60'
            : 'border-ink-300/60 bg-white/40 hover:border-seal-500 hover:bg-seal-50/40',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />

        <div
          className={[
            'mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors',
            isDragging ? 'border-seal-600 bg-seal-100' : 'border-ink-300 bg-paper group-hover:border-seal-500',
          ].join(' ')}
        >
          {isUploading ? (
            <svg className="h-6 w-6 animate-spin text-seal-700" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-ink-700" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4v11M12 4l-4 4M12 4l4 4M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <p className="font-serif text-lg text-ink-900">
          {isUploading ? 'Reading your document…' : 'Drop your contract template here'}
        </p>
        <p className="mt-1 text-sm text-ink-500">
          {isUploading
            ? `Detecting fields in ${fileName}`
            : 'or click to browse — accepts .docx, up to 25MB'}
        </p>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rust-500/30 bg-rust-500/5 px-4 py-3 text-sm text-rust-600 animate-slide-up">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.6" fill="currentColor" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
