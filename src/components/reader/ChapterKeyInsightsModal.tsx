import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, RefreshCw, BookOpen } from 'lucide-react';
import type { IHeaderSummary } from '@/src/types/book';

interface ChapterKeyInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
  bookTitle?: string;
  summaries: IHeaderSummary[];
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

export const ChapterKeyInsightsModal: React.FC<ChapterKeyInsightsModalProps> = ({
  isOpen,
  onClose,
  chapterTitle,
  bookTitle,
  summaries,
  onRegenerate,
  isGenerating = false,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopySection = (s: IHeaderSummary, idx: number) => {
    const textToCopy = `📌 ${s.header}\n\n${s.summary}\n\nKey Takeaways:\n${(s.keyPoints || []).map((kp) => `• ${kp}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-3xl shadow-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] overflow-hidden animate-in zoom-in-95 duration-150 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate leading-tight">
                {chapterTitle || 'Key Insights'}
              </h2>
              {bookTitle && (
                <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                  {bookTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isGenerating}
                title="Regenerate Key Insights"
                className="h-7 px-2.5 rounded-full text-xs font-medium bg-[var(--bg-secondary)] hover:bg-[var(--accent-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline text-[11px]">Regenerate</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Streamlined Body Content (No double/nested container boxes) */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 text-xs sm:text-sm">
          {summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--text-muted)]">
              <BookOpen className="w-8 h-8 mb-2.5 opacity-40" />
              <p className="font-semibold text-xs text-[var(--text-primary)]">No Key Insights Yet</p>
              <p className="text-[11px] mt-0.5 text-[var(--text-muted)] max-w-xs">
                Click &quot;Regenerate&quot; above to have AI extract core arguments and section summaries for this chapter.
              </p>
            </div>
          ) : (
            summaries.map((s, idx) => (
              <div
                key={`${s.header}_${idx}`}
                className="space-y-1.5 pb-4 border-b border-[var(--border-color)]/40 last:border-b-0 last:pb-0"
              >
                {/* Header title with one-click copy */}
                <div className="flex items-center justify-between gap-2 group">
                  <h3 className="font-bold text-[13px] sm:text-sm text-[var(--text-primary)] leading-snug">
                    {s.header}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopySection(s, idx)}
                    className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors shrink-0 cursor-pointer"
                    title="Copy section"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Summary paragraph */}
                <p className="text-xs sm:text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {s.summary}
                </p>

                {/* Bullet takeaways */}
                {Array.isArray(s.keyPoints) && s.keyPoints.length > 0 && (
                  <ul className="pt-1 space-y-1 pl-3.5 list-disc text-xs text-[var(--text-secondary)]/90 leading-relaxed marker:text-[var(--text-muted)]">
                    {s.keyPoints.map((point, pIdx) => (
                      <li key={pIdx} className="pl-0.5">
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
