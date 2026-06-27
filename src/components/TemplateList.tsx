'use client';

import { TemplateDTO } from '@/lib/types';

interface TemplateListProps {
  templates: TemplateDTO[];
  isLoading: boolean;
  onSelect: (template: TemplateDTO) => void;
}

export default function TemplateList({ templates, isLoading, onSelect }: TemplateListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-300/10" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-300/60 px-4 py-6 text-center text-sm text-ink-500">
        No saved templates yet — upload one above to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="group flex items-center justify-between gap-4 rounded-lg border border-ink-300/50 bg-white/50 px-4 py-3.5 text-left transition-all hover:border-seal-600/60 hover:bg-white"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-ink-300/60 bg-paper">
              <svg className="h-4.5 w-4.5 text-ink-700" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 1.5h5.5L13 5v9a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V2a.5.5 0 0 1 .5-.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-ink-900">{t.name}</p>
              <p className="text-xs text-ink-500">
                {t.fields.length} field{t.fields.length === 1 ? '' : 's'} detected ·{' '}
                {new Date(t.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-seal-600"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
