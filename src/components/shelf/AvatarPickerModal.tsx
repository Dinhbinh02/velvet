import React, { useState } from 'react';
import { Image, Upload, Check, Link2, X, Info } from 'lucide-react';
import { GHIBLI_OFFICIAL_COLLECTIONS, type IGhibliVibeImage } from '@/src/data/ghibliOfficialScenes';

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentAvatar?: string;
  onSelectAvatar: (avatarUrl: string) => void;
  onClose: () => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentAvatar,
  onSelectAvatar,
  onClose,
}) => {
  const [tab, setTab] = useState<'ghibli' | 'custom'>('ghibli');
  const [selectedMovie, setSelectedMovie] = useState<string>('all');
  const [customUrl, setCustomUrl] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelectAvatar(reader.result);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onSelectAvatar(customUrl.trim());
      onClose();
    }
  };

  // Filter Ghibli images by selected movie
  const allGhibliImages: IGhibliVibeImage[] = GHIBLI_OFFICIAL_COLLECTIONS.flatMap((c) => c.images);
  const displayImages =
    selectedMovie === 'all'
      ? allGhibliImages
      : GHIBLI_OFFICIAL_COLLECTIONS.find((c) => c.category === selectedMovie)?.images || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center shadow-xs">
              <Image className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Choose Reading Vibe Photo</h3>
              <p className="text-xs text-[var(--text-secondary)]">Select a curated theme photo or upload your own</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 flex items-center justify-between gap-4">
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] p-0.5 rounded-xl text-xs font-semibold w-full sm:w-auto">
            <button
              onClick={() => setTab('ghibli')}
              className={`py-1.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'ghibli'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Image className="w-3.5 h-3.5" />
              <span>Studio Ghibli (Official)</span>
            </button>

            <button
              onClick={() => setTab('custom')}
              className={`py-1.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'custom'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom</span>
            </button>
          </div>

          {/* Copyright Credit Badge */}
          {tab === 'ghibli' && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--text-muted)] bg-[var(--bg-secondary)]/60 px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
              <Info className="w-3 h-3 text-[var(--accent-color)]" />
              <span>Source: © Studio Ghibli (常識の範囲で)</span>
            </div>
          )}
        </div>

        {/* Category Pill Filters for Ghibli Movies */}
        {tab === 'ghibli' && (
          <div className="px-5 pt-3 pb-2 border-b border-[var(--border-color)]/60">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none scrollbar-thin">
              <button
                onClick={() => setSelectedMovie('all')}
                className={`px-3 py-1.5 rounded-xl shrink-0 font-semibold transition-all cursor-pointer ${
                  selectedMovie === 'all'
                    ? 'bg-[var(--accent-color)] text-white shadow-xs'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-color)]'
                }`}
              >
                All ({allGhibliImages.length})
              </button>
              {GHIBLI_OFFICIAL_COLLECTIONS.map((c) => {
                const isCatActive = selectedMovie === c.category;
                const shortName = c.category.split('(')[0].trim();
                return (
                  <button
                    key={c.category}
                    onClick={() => setSelectedMovie(c.category)}
                    className={`px-3 py-1.5 rounded-xl shrink-0 font-semibold transition-all cursor-pointer ${
                      isCatActive
                        ? 'bg-[var(--accent-color)] text-white shadow-xs'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-color)]'
                    }`}
                  >
                    {shortName} ({c.images.length})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'ghibli' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {displayImages.map((item) => {
                const isSelected = currentAvatar === item.url;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectAvatar(item.url);
                      onClose();
                    }}
                    className={`group relative aspect-16/9 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02] bg-[var(--bg-secondary)] shadow-xs ${
                      isSelected
                        ? 'border-[var(--accent-color)] shadow-lg ring-2 ring-[var(--accent-subtle)]'
                        : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Scene metadata overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2.5 flex items-center justify-between text-white">
                      <span className="text-xs font-bold truncate">{item.movieTitle}</span>
                      <span className="text-[10px] text-zinc-300 opacity-80 shrink-0">{item.source}</span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent-color)] text-white flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'custom' && (
            <div className="space-y-4 py-2">
              {/* File upload box */}
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)] bg-[var(--bg-secondary)]/50 rounded-2xl cursor-pointer transition-all">
                <Upload className="w-9 h-9 text-[var(--accent-color)] mb-2" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Upload Image from Computer</span>
                <span className="text-[11px] text-[var(--text-muted)] mt-0.5">Supports PNG, JPG, WebP (Landscape recommended)</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Direct URL input */}
              <form onSubmit={handleApplyCustomUrl} className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>Or paste high-res image URL:</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://www.ghibli.jp/gallery/...jpg"
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:outline-none text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    disabled={!customUrl.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30 text-center text-[10px] text-[var(--text-muted)]">
          All Studio Ghibli scene photos are provided under fair non-commercial personal use (© Studio Ghibli Inc.)
        </div>
      </div>
    </div>
  );
};
