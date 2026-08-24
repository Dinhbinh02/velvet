import React from 'react';
import { BookOpen, CheckCircle2, AlertCircle, Sparkles, HardDrive, FileText, Loader2, X } from 'lucide-react';

export type ImportStep = 'optimizing' | 'parsing' | 'saving' | 'finalizing' | 'ready' | 'error';

export interface BookImportState {
  isImporting: boolean;
  fileName: string;
  fileSize?: number;
  step: ImportStep;
  progressPercent: number;
  errorMessage?: string | null;
}

interface BookImportOverlayProps {
  state: BookImportState | null;
  onClose?: () => void;
}

const STEP_LABELS: Record<ImportStep, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  optimizing: {
    title: 'Optimizing & Compressing...',
    subtitle: 'Compressing images and hashing content to save storage space',
    icon: Sparkles,
  },
  parsing: {
    title: 'Extracting Book Details...',
    subtitle: 'Reading metadata, cover artwork, and table of contents',
    icon: FileText,
  },
  saving: {
    title: 'Saving to Offline Storage...',
    subtitle: 'Writing book binary into high-speed OPFS storage for offline reading',
    icon: HardDrive,
  },
  finalizing: {
    title: 'Finalizing...',
    subtitle: 'Updating library database and preparing your reader experience',
    icon: Loader2,
  },
  ready: {
    title: 'Book Added Successfully!',
    subtitle: 'Opening reader with your customized settings...',
    icon: CheckCircle2,
  },
  error: {
    title: 'Unable to Add Book',
    subtitle: 'An error occurred while processing the EPUB file',
    icon: AlertCircle,
  },
};

export const BookImportOverlay: React.FC<BookImportOverlayProps> = ({ state, onClose }) => {
  if (!state || !state.isImporting) return null;

  const currentStepInfo = STEP_LABELS[state.step] || STEP_LABELS.optimizing;
  const StepIcon = currentStepInfo.icon;
  const isError = state.step === 'error';
  const isReady = state.step === 'ready';

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        className={`relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-2xl transition-all transform animate-in zoom-in-95 duration-200 ${
          isError ? 'border-red-500/40' : ''
        }`}
      >
        {/* Close Button on Error */}
        {isError && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center text-center space-y-5">
          {/* Animated Central Icon with Glow */}
          <div className="relative flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-xl ${
                isError
                  ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                  : 'bg-[var(--accent-subtle)] text-[var(--accent-color)] border border-[var(--accent-color)]/30'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-10 h-10 animate-pulse" />
              ) : isReady ? (
                <CheckCircle2 className="w-10 h-10 animate-bounce text-[var(--accent-color)]" />
              ) : (
                <div className="relative flex items-center justify-center">
                  <BookOpen className="w-9 h-9 stroke-[2]" />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-color)]" />
                  </div>
                </div>
              )}
            </div>

            {/* Ripple Pulse Ring */}
            {!isError && !isReady && (
              <div className="absolute inset-0 rounded-3xl border-2 border-[var(--accent-color)] opacity-20 animate-ping pointer-events-none" />
            )}
          </div>

          {/* Book Info Pill */}
          <div className="flex items-center gap-2 max-w-full px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] font-medium">
            <FileText className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-[260px]" title={state.fileName}>
              {state.fileName}
            </span>
            {state.fileSize && (
              <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                • {formatFileSize(state.fileSize)}
              </span>
            )}
          </div>

          {/* Step Heading & Subtitle */}
          <div className="space-y-1.5 w-full">
            <h3
              className={`text-lg sm:text-xl font-bold tracking-tight ${
                isError ? 'text-red-500' : 'text-[var(--text-primary)]'
              }`}
            >
              {isError ? 'Unable to process book' : currentStepInfo.title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 px-2">
              {isError
                ? state.errorMessage || 'Invalid EPUB file format or corrupted package.'
                : currentStepInfo.subtitle}
            </p>
          </div>

          {/* Progress Bar & Status */}
          {!isError && (
            <div className="w-full space-y-2 pt-1">
              <div className="w-full h-2 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out bg-[var(--accent-color)]"
                  style={{ width: `${Math.min(100, Math.max(8, state.progressPercent))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium px-1">
                <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                  <StepIcon className={`w-3 h-3 ${!isReady ? 'animate-spin text-[var(--accent-color)]' : 'text-[var(--accent-color)]'}`} />
                  {state.step === 'optimizing' && 'Optimizing images'}
                  {state.step === 'parsing' && 'Extracting metadata'}
                  {state.step === 'saving' && 'Saving to OPFS'}
                  {state.step === 'finalizing' && 'Syncing library'}
                  {state.step === 'ready' && 'Ready'}
                </span>
                <span className="font-semibold text-[var(--text-secondary)]">{Math.round(state.progressPercent)}%</span>
              </div>
            </div>
          )}

          {/* Error Action Button */}
          {isError && onClose && (
            <div className="pt-2 w-full">
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs hover:shadow-sm"
              >
                Close and Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
