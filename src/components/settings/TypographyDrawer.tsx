import React, { useRef, useState, useEffect } from 'react';
import { X, Type, Columns, RotateCcw, AlignLeft, AlignJustify, Palette, Upload, Trash2, Keyboard, Bot, Highlighter, ExternalLink, Info, Waves, Volume2, Square } from 'lucide-react';
import type { IReaderSettings, ICustomFont, ITTSSettings } from '@/src/types/book';
import { DEFAULT_SETTINGS } from '@/src/hooks/useReaderSettings';
import { FontService } from '@/src/services/fontService';
import { AmbientSoundService, AMBIENT_SOUNDS } from '@/src/services/ambientSoundService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/schema';

interface TypographyDrawerProps {
  settings: IReaderSettings;
  targetSection?: string | null;
  onUpdate: (updates: Partial<IReaderSettings>) => void;
  onClose: () => void;
}

export const TypographyDrawer: React.FC<TypographyDrawerProps> = ({
  settings,
  targetSection,
  onUpdate,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auto-scroll to targetSection ONLY when explicitly requested (e.g. clicking AI bot without key)
  useEffect(() => {
    if (targetSection === 'gemini') {
      const timer = setTimeout(() => {
        const geminiEl = document.getElementById('gemini-api-key-section');
        if (geminiEl) {
          geminiEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const textarea = geminiEl.querySelector('textarea');
          textarea?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [targetSection]);

  const customFonts = useLiveQuery(() => db.customFonts.reverse().sortBy('createdAt'), []) || [];

  // Helper to ensure full ITTSSettings
  const getFullTTSSettings = (partial: Partial<ITTSSettings>): ITTSSettings => {
    const base: ITTSSettings = {
      provider: 'google',
      voice: 'vi',
      rate: 1.0,
      pitch: 1.0,
      autoScroll: true,
      quickReadShortcut: 'Shift',
      ...settings.ttsSettings,
    };
    return { ...base, ...partial };
  };

  const [recordingTarget, setRecordingTarget] = useState<'quickRead' | 'highlight' | 'prevPage' | 'nextPage' | null>(null);
  const [ambientState, setAmbientState] = useState(() => AmbientSoundService.getState());

  useEffect(() => {
    return AmbientSoundService.subscribe(() => {
      setAmbientState(AmbientSoundService.getState());
    });
  }, []);

  // Listen for key presses when user is recording a shortcut
  useEffect(() => {
    if (!recordingTarget) return;

    const handleRecordKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore lone modifier keys
      if (['Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      // If user presses Shift alone, allow it as 'Shift'
      if (e.key === 'Shift' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (recordingTarget === 'quickRead') {
          onUpdate({ ttsSettings: getFullTTSSettings({ quickReadShortcut: 'Shift' }) });
        } else if (recordingTarget === 'highlight') {
          onUpdate({ highlightShortcut: 'Shift' });
        } else if (recordingTarget === 'prevPage') {
          onUpdate({ prevPageShortcut: 'Shift' });
        } else if (recordingTarget === 'nextPage') {
          onUpdate({ nextPageShortcut: 'Shift' });
        }
        setRecordingTarget(null);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey && e.key !== 'Shift') parts.push('Shift');
      if (e.metaKey) parts.push('Cmd');

      let mainKey = e.key;
      if (mainKey === ' ') mainKey = 'Space';
      else if (mainKey === 'ArrowLeft') mainKey = 'ArrowLeft';
      else if (mainKey === 'ArrowRight') mainKey = 'ArrowRight';
      else if (mainKey === 'ArrowUp') mainKey = 'ArrowUp';
      else if (mainKey === 'ArrowDown') mainKey = 'ArrowDown';
      else if (mainKey.length === 1) mainKey = mainKey.toUpperCase();

      if (!['Control', 'Alt', 'Meta', 'Shift', 'CONTROL', 'ALT', 'META', 'SHIFT'].includes(mainKey)) {
        parts.push(mainKey);
      }

      if (parts.length > 0) {
        const combo = parts.join('+');
        if (recordingTarget === 'quickRead') {
          onUpdate({ ttsSettings: getFullTTSSettings({ quickReadShortcut: combo }) });
        } else if (recordingTarget === 'highlight') {
          onUpdate({ highlightShortcut: combo });
        } else if (recordingTarget === 'prevPage') {
          onUpdate({ prevPageShortcut: combo });
        } else if (recordingTarget === 'nextPage') {
          onUpdate({ nextPageShortcut: combo });
        }
        setRecordingTarget(null);
      }
    };

    window.addEventListener('keydown', handleRecordKey, true);
    return () => window.removeEventListener('keydown', handleRecordKey, true);
  }, [recordingTarget, settings.ttsSettings, onUpdate]);

  const defaultFontFamilies = [
    { id: "'Literata', Georgia, serif", label: 'Literata (Bookerly Style)' },
    { id: "'Bitter', serif", label: 'Bitter (Slab Serif)' },
    { id: "'Merriweather', serif", label: 'Merriweather (Classic Serif)' },
    { id: "'Inter', -apple-system, sans-serif", label: 'Inter (Modern Sans)' },
  ];

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      let lastImportedFamily: string | null = null;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fonts = await FontService.importFont(file);
        if (fonts.length > 0) {
          lastImportedFamily = fonts[0].name;
        }
      }
      if (lastImportedFamily) {
        // Automatically switch to the newly uploaded font family
        onUpdate({ fontFamily: lastImportedFamily });
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to import font');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFont = async (e: React.MouseEvent, font: ICustomFont) => {
    e.stopPropagation();
    await FontService.deleteFont(font.id);
    if (settings.fontFamily === font.name) {
      onUpdate({ fontFamily: DEFAULT_SETTINGS.fontFamily });
    }
  };

  const themes: { id: IReaderSettings['theme']; label: string; bg: string; text: string; border: string }[] = [
    { id: 'light', label: 'Light', bg: '#FFFFFF', text: '#000000', border: '#CCCCCC' },
    { id: 'paper', label: 'Paper', bg: '#F2F2F2', text: '#000000', border: '#CCCCCC' },
    { id: 'sepia', label: 'Sepia', bg: '#F4ECD8', text: '#1A1A1A', border: '#D6C8AA' },
    { id: 'dark', label: 'Dark', bg: '#000000', text: '#FFFFFF', border: '#444444' },
    { id: 'amoled', label: 'OLED', bg: '#000000', text: '#FFFFFF', border: '#333333' },
    { id: 'nord', label: 'Nord', bg: '#2E3440', text: '#ECEFF4', border: '#4C566A' },
  ];

  return (
    <div className="fixed right-0 top-0 bottom-0 w-84 bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-l border-[var(--border-color)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Reading Settings</h3>
            <p className="text-[11px] text-[var(--text-secondary)]">Themes, typography & layout</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Body */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Themes Palette Swatches */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              <span>Theme Appearance</span>
            </label>
            <span className="text-[11px] font-semibold text-[var(--accent-color)] capitalize">{settings.theme}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => onUpdate({ theme: t.id })}
                className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer border ${
                  settings.theme === t.id
                    ? 'ring-2 ring-[var(--accent-color)] border-transparent shadow-md scale-102'
                    : 'hover:border-[var(--border-hover)] opacity-90 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: t.bg,
                  color: t.text,
                  borderColor: t.border,
                }}
              >
                <div className="w-4 h-4 rounded-full border border-[currentColor]/30 flex items-center justify-center text-[9px] font-bold">
                  {settings.theme === t.id ? '✓' : ''}
                </div>
                <span className="text-[11px] tracking-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Font Family
            </label>

            {/* Import Font Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-[11px] font-semibold text-[var(--accent-color)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              <span>{isUploading ? 'Importing...' : 'Import (.zip)'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.woff2,.woff,.ttf,.otf"
              multiple
              onChange={handleFontUpload}
              className="hidden"
            />
          </div>

          {uploadError && (
            <p className="text-[11px] text-red-500 bg-red-500/10 p-2 rounded-lg">{uploadError}</p>
          )}

          <div className="grid grid-cols-1 gap-1.5">
            {/* Custom Uploaded Fonts (Grouped by Family Name) */}
            {customFonts.length > 0 && (
              <div className="space-y-1.5 mb-1">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                  Custom Fonts
                </span>
                {Array.from(new Set(customFonts.map((f) => f.name))).map((familyName) => {
                  const familyVariants = customFonts.filter((f) => f.name === familyName);
                  const isSelected = settings.fontFamily === familyName;

                  return (
                    <div
                      key={familyName}
                      onClick={() => onUpdate({ fontFamily: familyName })}
                      className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer border group font-normal ${
                        isSelected
                          ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] shadow-sm'
                          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                      }`}
                      style={{ fontFamily: familyName, fontWeight: 400 }}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="truncate">{familyName}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && <span className="text-xs font-bold mr-1">✓</span>}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            for (const v of familyVariants) {
                              await handleDeleteFont(e, v);
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title={`Delete ${familyName} family`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Standard Presets */}
            {customFonts.length > 0 && (
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mt-1">
                System Presets
              </span>
            )}
            {defaultFontFamilies.map((font) => (
              <button
                key={font.id}
                onClick={() => onUpdate({ fontFamily: font.id })}
                className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer border font-normal ${
                  settings.fontFamily === font.id
                    ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] shadow-sm'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                }`}
                style={{ fontFamily: font.id, fontWeight: 400 }}
              >
                <span>{font.label}</span>
                {settings.fontFamily === font.id && <span className="text-xs font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]">Font Size</span>
            <span className="font-mono text-[var(--accent-color)] font-bold">{settings.fontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] font-serif">A</span>
            <input
              type="range"
              min="14"
              max="32"
              step="1"
              value={settings.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent-color)] cursor-pointer"
            />
            <span className="text-base text-[var(--text-primary)] font-serif font-bold">A</span>
          </div>
        </div>

        {/* Line Height */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]">Line Spacing</span>
            <span className="font-mono text-[var(--accent-color)] font-bold">{settings.lineHeight}</span>
          </div>
          <input
            type="range"
            min="1.2"
            max="2.4"
            step="0.1"
            value={settings.lineHeight}
            onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
            className="w-full accent-[var(--accent-color)] cursor-pointer"
          />
        </div>

        {/* Text Alignment */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Alignment
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'left', label: 'Left Align', icon: AlignLeft },
              { id: 'justify', label: 'Justified', icon: AlignJustify },
            ].map((align) => (
              <button
                key={align.id}
                onClick={() => onUpdate({ textAlign: align.id as any })}
                className={`py-2 rounded-xl text-xs font-semibold cursor-pointer border flex items-center justify-center gap-1.5 ${
                  settings.textAlign === align.id
                    ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <align.icon className="w-3.5 h-3.5" />
                <span>{align.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Layout Mode */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Page Layout
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'paginated-1col', label: '1 Column' },
              { id: 'paginated-2col', label: '2 Columns' },
              { id: 'continuous', label: 'Continuous' },
            ].map((layout) => (
              <button
                key={layout.id}
                onClick={() => onUpdate({ layoutMode: layout.id as any })}
                className={`py-2.5 rounded-xl text-xs font-semibold cursor-pointer border flex flex-col items-center gap-1 ${
                  settings.layoutMode === layout.id
                    ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="text-[10px]">{layout.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Page Turn Shortcuts */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Page Turn Shortcuts
          </label>

          <div className="space-y-1.5">
            {/* Previous Page Row */}
            <button
              type="button"
              onClick={() => setRecordingTarget(recordingTarget === 'prevPage' ? null : 'prevPage')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                recordingTarget === 'prevPage'
                  ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] ring-2 ring-[var(--accent-color)]/30 animate-pulse'
                  : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]'
              }`}
            >
              <span className="text-xs font-medium text-[var(--text-primary)]">Previous Page</span>
              <span className="text-xs font-mono font-bold text-[var(--text-primary)] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs">
                {recordingTarget === 'prevPage' ? 'Press key...' : settings.prevPageShortcut === 'ArrowLeft' ? '← Left Arrow' : settings.prevPageShortcut || '← Left Arrow'}
              </span>
            </button>

            {/* Next Page Row */}
            <button
              type="button"
              onClick={() => setRecordingTarget(recordingTarget === 'nextPage' ? null : 'nextPage')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                recordingTarget === 'nextPage'
                  ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] ring-2 ring-[var(--accent-color)]/30 animate-pulse'
                  : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]'
              }`}
            >
              <span className="text-xs font-medium text-[var(--text-primary)]">Next Page</span>
              <span className="text-xs font-mono font-bold text-[var(--text-primary)] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs">
                {recordingTarget === 'nextPage' ? 'Press key...' : settings.nextPageShortcut === 'ArrowRight' ? 'Right Arrow →' : settings.nextPageShortcut || 'Right Arrow →'}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Read Shortcut */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Quick Read Shortcut
          </label>

          {/* Interactive Record Shortcut Button */}
          <button
            type="button"
            onClick={() => setRecordingTarget(recordingTarget === 'quickRead' ? null : 'quickRead')}
            className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              recordingTarget === 'quickRead'
                ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] ring-2 ring-[var(--accent-color)]/30 animate-pulse'
                : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Keyboard className={`w-4 h-4 ${recordingTarget === 'quickRead' ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`} />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {recordingTarget === 'quickRead' ? 'Press any key on keyboard...' : 'Record Custom Shortcut'}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {recordingTarget === 'quickRead' ? 'Press key combination (e.g. Shift, Alt+S)' : 'Click to bind your favorite key'}
                </span>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-[var(--text-primary)] px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)]">
              {recordingTarget === 'quickRead' ? '...' : settings.ttsSettings?.quickReadShortcut || 'Shift'}
            </span>
          </button>

          {/* Popular Presets */}
          <div className="grid grid-cols-4 gap-1">
            {['Shift', 'Alt+S', 'Alt+Q', 'Space'].map((sc) => {
              const activeSc = settings.ttsSettings?.quickReadShortcut || 'Shift';
              const isSelected = activeSc === sc;
              return (
                <button
                  key={sc}
                  type="button"
                  onClick={() => {
                    setRecordingTarget(null);
                    onUpdate({
                      ttsSettings: getFullTTSSettings({ quickReadShortcut: sc }),
                    });
                  }}
                  className={`py-1.5 rounded-xl text-[11px] font-mono font-medium cursor-pointer border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] font-bold shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  {sc}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Select text & press shortcut to hear Google speech instantly. Pressing again replays.
          </p>
        </div>

        {/* 6. Highlight Settings (Color & Shortcut) */}
        <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            Highlight Color & Shortcut
          </span>

          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Yellow', color: '#fef08a', border: '#fde047' },
              { label: 'Green', color: '#bbf7d0', border: '#86efac' },
              { label: 'Blue', color: '#bfdbfe', border: '#93c5fd' },
              { label: 'Pink', color: '#fbcfe8', border: '#f472b6' },
              { label: 'Orange', color: '#fed7aa', border: '#fdba74' },
            ].map((preset) => {
              const activeColor = settings.highlightColor || '#fef08a';
              const isSelected = activeColor === preset.color;
              return (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => onUpdate({ highlightColor: preset.color })}
                  className={`h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                    isSelected ? 'ring-2 ring-[var(--accent-color)] ring-offset-2 scale-105 font-bold' : 'hover:scale-102'
                  }`}
                  style={{
                    backgroundColor: preset.color,
                    borderColor: preset.border,
                  }}
                  title={preset.label}
                >
                  {isSelected && <span className="text-xs text-neutral-800 font-bold">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-1 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[var(--text-primary)]">
                Highlight Shortcut
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">Instant highlight on selection</span>
            </div>

            {/* Shortcut Recorder Button */}
            <button
              type="button"
              onClick={() => setRecordingTarget(recordingTarget === 'highlight' ? null : 'highlight')}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                recordingTarget === 'highlight'
                  ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] ring-2 ring-[var(--accent-color)]/20 shadow-sm'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Keyboard className={`w-4 h-4 ${recordingTarget === 'highlight' ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`} />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {recordingTarget === 'highlight' ? 'Press any key on keyboard...' : 'Record Custom Shortcut'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {recordingTarget === 'highlight' ? 'Press any key (e.g. H, Shift+H, Alt+H)' : 'Click to bind your favorite key'}
                  </span>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-[var(--text-primary)] px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)]">
                {recordingTarget === 'highlight' ? '...' : settings.highlightShortcut || 'H'}
              </span>
            </button>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1">
              {['H', 'Shift+H', 'Alt+H', 'Cmd+H'].map((sc) => {
                const activeSc = settings.highlightShortcut || 'H';
                const isSelected = activeSc.toUpperCase() === sc.toUpperCase();
                return (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => {
                      setRecordingTarget(null);
                      onUpdate({ highlightShortcut: sc });
                    }}
                    className={`py-1.5 rounded-xl text-[11px] font-mono font-medium cursor-pointer border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] font-bold shadow-sm'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    {sc}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              Select text & press shortcut to highlight instantly.
            </p>
          </div>
        </div>

        {/* 7. Ambient White Noise & Soundscapes */}
        <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-[var(--accent-color)]" />
              Ambient Soundscapes
            </span>
            {ambientState.isPlaying && (
              <button
                type="button"
                onClick={() => AmbientSoundService.stop()}
                className="px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2 pt-0.5">
            <Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ambientState.volume}
              onChange={(e) => AmbientSoundService.setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-[var(--border-color)] accent-[var(--accent-color)] rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-[var(--text-muted)] w-7 text-right">
              {Math.round(ambientState.volume * 100)}%
            </span>
          </div>

          {/* Sound Presets Grid */}
          <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-0.5">
            {AMBIENT_SOUNDS.map((sound) => {
              const isActive = ambientState.isPlaying && ambientState.currentSound === sound.id;
              return (
                <button
                  key={sound.id}
                  type="button"
                  onClick={() => AmbientSoundService.toggleSound(sound.id)}
                  className={`p-2 rounded-xl text-left transition-all border flex items-center justify-between gap-1.5 cursor-pointer ${
                    isActive
                      ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] text-[var(--accent-color)] font-bold shadow-xs'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                  }`}
                  title={sound.description}
                >
                  <span className="text-xs truncate">{sound.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 8. Gemini AI Settings */}
        <div id="gemini-api-key-section" className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-[var(--accent-color)]" />
              Gemini API Key
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-[var(--accent-color)] hover:underline inline-flex items-center gap-1"
            >
              Get Free Key
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <textarea
            rows={2}
            value={settings.geminiApiKey || ''}
            onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
            placeholder="Paste your Gemini API key (AQ...)"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] resize-none"
          />

          {/* Quick Step-by-Step Guide */}
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]/70 space-y-1.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-[11px]">
              <Info className="w-3 h-3 text-[var(--accent-color)] shrink-0" />
              <span>How to get a free API Key:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[10.5px]">
              <li>
                Go to{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-color)] font-medium hover:underline inline-flex items-center gap-0.5"
                >
                  Google AI Studio <ExternalLink className="w-2.5 h-2.5 inline" />
                </a>{' '}
                and log in.
              </li>
              <li>Click <strong>"Create API key"</strong> (or "Get API key").</li>
              <li>Choose/create a project, then copy your key (starts with <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)] font-mono text-[10px]">AQ...</code>).</li>
            </ol>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Used for instant vocabulary definition, chapter summaries & IPA pronunciation.
          </p>
        </div>

        {/* Reset Defaults */}
        <button
          onClick={() => onUpdate(DEFAULT_SETTINGS)}
          className="w-full py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>
    </div>
  );
};
