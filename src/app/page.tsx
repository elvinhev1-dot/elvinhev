'use client';

import { useEffect, useState } from 'react';
import StepIndicator from '@/components/StepIndicator';
import TemplateUploader from '@/components/TemplateUploader';
import TemplateList from '@/components/TemplateList';
import ContractForm from '@/components/ContractForm';
import DownloadPanel from '@/components/DownloadPanel';
import { TemplateDTO } from '@/lib/types';

type Step = 0 | 1 | 2;

const STORAGE_KEY = 'contractly_templates';

function loadTemplatesFromStorage(): TemplateDTO[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplatesToStorage(templates: TemplateDTO[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage quota exceeded or unavailable — silently continue
  }
}

export default function HomePage() {
  const [step, setStep] = useState<Step>(0);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDTO | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('contract.docx');

  useEffect(() => {
    const saved = loadTemplatesFromStorage();
    setTemplates(saved);
    setIsLoadingTemplates(false);
  }, []);

  const handleTemplateReady = (template: TemplateDTO) => {
    setTemplates((prev) => {
      const next = [template, ...prev.filter((t) => t.id !== template.id)];
      saveTemplatesToStorage(next);
      return next;
    });
    setSelectedTemplate(template);
    setStep(1);
  };

  const handleGenerate = async (values: Record<string, string>) => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docxBase64: selectedTemplate.docxBase64,
          fields: selectedTemplate.fields,
          name: selectedTemplate.name,
          values,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate the document.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${selectedTemplate.name}.docx`;

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadFilename(filename);
      setStep(2);
    } catch (err: any) {
      setGenerateError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setStep(0);
    setSelectedTemplate(null);
    setGenerateError(null);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
  };

  const backToStepZero = () => {
    setStep(0);
    setSelectedTemplate(null);
    setGenerateError(null);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-16">
      {/* Letterhead */}
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-ink-900">
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-ink-900" fill="none">
              <path d="M4 1.5h5.5L13 5v9a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">Contractly</span>
        </div>

        <div>
          <h1 className="font-serif text-3xl text-ink-900 sm:text-4xl">
            Turn one template into every contract.
          </h1>
          <p className="mt-2 max-w-lg text-ink-500">
            Upload a Word contract once. From then on, fill a short form and get a finished,
            fully-replaced .docx in seconds — buyer, bank details, dates, signatures, all of it.
          </p>
        </div>

        <StepIndicator steps={['Template', 'Details', 'Download']} currentStep={step} />
      </header>

      {/* Step content */}
      <section className="rounded-2xl border border-ink-300/30 bg-white/40 p-6 shadow-card backdrop-blur-sm sm:p-9">
        {step === 0 && (
          <div className="flex flex-col gap-8 animate-fade-in">
            <div>
              <h2 className="font-serif text-xl text-ink-900">Choose a template</h2>
              <p className="mt-1 text-sm text-ink-500">
                Upload a new contract to auto-detect its fillable fields, or reuse one you uploaded before.
              </p>
            </div>

            <TemplateUploader onUploaded={handleTemplateReady} />

            {(templates.length > 0 || isLoadingTemplates) && (
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink-300/40" />
                  <span className="font-mono text-xs uppercase tracking-wider text-ink-300">
                    or use a saved template
                  </span>
                  <span className="h-px flex-1 bg-ink-300/40" />
                </div>
                <TemplateList
                  templates={templates}
                  isLoading={isLoadingTemplates}
                  onSelect={(t) => {
                    setSelectedTemplate(t);
                    setStep(1);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {step === 1 && selectedTemplate && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl text-ink-900">Fill in the details</h2>
                <p className="mt-1 text-sm text-ink-500">
                  These values will replace every matching placeholder in{' '}
                  <span className="font-medium text-ink-800">{selectedTemplate.name}</span>.
                </p>
              </div>
              <button
                onClick={backToStepZero}
                className="shrink-0 font-mono text-xs uppercase tracking-wider text-ink-500 underline-offset-2 hover:text-seal-700 hover:underline"
              >
                Change template
              </button>
            </div>

            <ContractForm
              template={selectedTemplate}
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
              serverError={generateError}
            />
          </div>
        )}

        {step === 2 && downloadUrl && (
          <DownloadPanel downloadUrl={downloadUrl} filename={downloadFilename} onStartOver={reset} />
        )}
      </section>

      <footer className="mt-10 text-center font-mono text-[11px] uppercase tracking-wider text-ink-300">
        Documents are processed on-server and never stored — templates saved locally in your browser
      </footer>
    </main>
  );
}
