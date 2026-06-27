'use client';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number; // 0-indexed
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {steps.map((label, i) => {
        const state = i < currentStep ? 'done' : i === currentStep ? 'active' : 'upcoming';
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={[
                  'stamp transition-colors duration-300',
                  state === 'done'
                    ? 'border-seal-600 bg-seal-600 text-paper stamp-active'
                    : state === 'active'
                    ? 'border-seal-600 text-seal-700 stamp-active'
                    : 'border-ink-300 text-ink-300',
                ].join(' ')}
                style={state === 'active' ? { borderColor: '#2c5a4c' } : undefined}
              >
                {state === 'done' ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                    <path
                      d="M3 8.5L6.2 11.7L13 4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={[
                  'hidden font-mono text-xs uppercase tracking-wider sm:inline',
                  state === 'upcoming' ? 'text-ink-300' : 'text-ink-700',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={[
                  'h-px w-6 sm:w-10',
                  i < currentStep ? 'bg-seal-600' : 'bg-ink-300/50',
                ].join(' ')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
