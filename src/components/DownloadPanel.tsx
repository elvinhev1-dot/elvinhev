'use client';

interface DownloadPanelProps {
  downloadUrl: string;
  filename: string;
  onStartOver: () => void;
}

export default function DownloadPanel({ downloadUrl, filename, onStartOver }: DownloadPanelProps) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-seal-600/20 bg-seal-50/50 px-8 py-12 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-seal-600 bg-seal-600/10">
        <svg className="h-7 w-7 text-seal-700" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h3 className="font-serif text-2xl text-ink-900">Your contract is ready</h3>
        <p className="mt-1.5 max-w-sm text-sm text-ink-500">
          Every placeholder has been filled in across the body, tables, and signature blocks.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={downloadUrl}
          download={filename}
          className="inline-flex items-center gap-2 rounded-lg bg-seal-700 px-6 py-3 font-medium text-paper shadow-card transition-all hover:bg-seal-800 hover:shadow-cardHover"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v8m0 0L5 7m3 3l3-3M3 13.5h10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Download .docx
        </a>
        <button
          onClick={onStartOver}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-300/60 bg-white/60 px-6 py-3 font-medium text-ink-800 transition-colors hover:bg-white"
        >
          Generate another
        </button>
      </div>

      <p className="font-mono text-xs text-ink-300">{filename}</p>
    </div>
  );
}
