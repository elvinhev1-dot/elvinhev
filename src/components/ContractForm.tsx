'use client';

import { useForm } from 'react-hook-form';
import { TemplateDTO } from '@/lib/types';

interface ContractFormProps {
  template: TemplateDTO;
  onSubmit: (values: Record<string, string>) => void;
  isGenerating: boolean;
  serverError: string | null;
}

/**
 * Groups fields for nicer visual organization. Falls back to a flat
 * list for templates whose field ids don't match these buckets (e.g.
 * a fully custom uploaded template) — those fields land in "Other".
 */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Contract details', ids: ['contract_number', 'contract_date'] },
  { title: 'Buyer', ids: ['buyer_company', 'director_name', 'buyer_tin', 'address'] },
  {
    title: 'Buyer’s bank',
    ids: ['bank_name', 'bank_tin', 'bank_mh', 'bank_hh', 'bank_code', 'swift_code'],
  },
];

export default function ContractForm({ template, onSubmit, isGenerating, serverError }: ContractFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({ mode: 'onBlur' });

  const fieldsById = new Map(template.fields.map((f) => [f.id, f]));
  const groupedIds = new Set(GROUPS.flatMap((g) => g.ids));
  const otherFields = template.fields.filter((f) => !groupedIds.has(f.id));

  const renderField = (fieldId: string) => {
    const field = fieldsById.get(fieldId);
    if (!field) return null;
    const error = errors[field.id];

    return (
      <div key={field.id} className="flex flex-col gap-1.5">
        <label htmlFor={field.id} className="flex items-baseline justify-between text-sm font-medium text-ink-800">
          <span>
            {field.label}
            {field.required && <span className="ml-1 text-rust-500">*</span>}
          </span>
          <span className="font-mono text-[11px] text-ink-300">{field.placeholder}</span>
        </label>

        {field.inputType === 'textarea' ? (
          <textarea
            id={field.id}
            rows={3}
            placeholder={field.example}
            className={[
              'w-full rounded-lg border bg-white/70 px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-300 transition-colors focus:bg-white',
              error ? 'border-rust-500/60' : 'border-ink-300/60 focus:border-seal-600',
            ].join(' ')}
            {...register(field.id, { required: field.required })}
          />
        ) : (
          <input
            id={field.id}
            type="text"
            placeholder={field.example}
            autoComplete="off"
            className={[
              'w-full rounded-lg border bg-white/70 px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-300 transition-colors focus:bg-white',
              field.id.includes('tin') ||
              field.id.includes('bank_') ||
              field.id.includes('swift') ||
              field.id === 'contract_number'
                ? 'font-mono'
                : '',
              error ? 'border-rust-500/60' : 'border-ink-300/60 focus:border-seal-600',
            ].join(' ')}
            {...register(field.id, { required: field.required })}
          />
        )}

        {error && <span className="text-xs text-rust-600">{field.label} is required.</span>}
        <span className="text-[11px] text-ink-300">
          Appears {field.occurrences} {field.occurrences === 1 ? 'time' : 'times'} in the document
        </span>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
      {GROUPS.map((group) => {
        const idsPresent = group.ids.filter((id) => fieldsById.has(id));
        if (idsPresent.length === 0) return null;
        return (
          <fieldset key={group.title} className="flex flex-col gap-4">
            <legend className="mb-1 font-serif text-base text-ink-900">{group.title}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {idsPresent.map((id) => renderField(id))}
            </div>
          </fieldset>
        );
      })}

      {otherFields.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-serif text-base text-ink-900">Other fields</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {otherFields.map((f) => renderField(f.id))}
          </div>
        </fieldset>
      )}

      {serverError && (
        <div className="flex items-start gap-2 rounded-lg border border-rust-500/30 bg-rust-500/5 px-4 py-3 text-sm text-rust-600">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.6" fill="currentColor" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isGenerating}
        className="group relative inline-flex items-center justify-center gap-2 self-start rounded-lg bg-seal-700 px-6 py-3 font-medium text-paper shadow-card transition-all hover:bg-seal-800 hover:shadow-cardHover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isGenerating ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            Generating document…
          </>
        ) : (
          <>
            Generate document
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
