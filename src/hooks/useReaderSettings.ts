import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { IReaderSettings } from '../types/book';

const SETTINGS_ID = 'global-settings';

export const DEFAULT_SETTINGS: IReaderSettings = {
  id: SETTINGS_ID,
  theme: 'paper',
  fontFamily: "'Literata', Georgia, serif",
  fontSize: 18,
  lineHeight: 1.65,
  paragraphSpacing: 1.2,
  maxWidth: 760,
  textAlign: 'left',
  layoutMode: 'paginated-1col',
  prevPageShortcut: 'ArrowLeft',
  nextPageShortcut: 'ArrowRight',
  highlightColor: '#fef08a',
  highlightShortcut: 'h',
  ttsSettings: {
    provider: 'google',
    voice: 'vi',
    rate: 1.0,
    pitch: 1.0,
    autoScroll: true,
    quickReadShortcut: 'Shift',
  },
};

export function useReaderSettings() {
  const savedSettings = useLiveQuery(
    async () => {
      try {
        const setting = await db.settings.get(SETTINGS_ID);
        return setting || DEFAULT_SETTINGS;
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    []
  );

  const settings: IReaderSettings = savedSettings || DEFAULT_SETTINGS;

  const updateSettings = async (updates: Partial<IReaderSettings>) => {
    try {
      const current = (await db.settings.get(SETTINGS_ID)) || DEFAULT_SETTINGS;
      const newSettings = { ...current, ...updates };
      await db.settings.put(newSettings);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const setTheme = (theme: IReaderSettings['theme']) => updateSettings({ theme });
  const setFontFamily = (fontFamily: string) => updateSettings({ fontFamily });
  const setFontSize = (fontSize: number) => updateSettings({ fontSize });
  const setLineHeight = (lineHeight: number) => updateSettings({ lineHeight });
  const setParagraphSpacing = (paragraphSpacing: number) => updateSettings({ paragraphSpacing });
  const setMaxWidth = (maxWidth: number) => updateSettings({ maxWidth });
  const setTextAlign = (textAlign: IReaderSettings['textAlign']) => updateSettings({ textAlign });
  const setLayoutMode = (layoutMode: IReaderSettings['layoutMode']) => updateSettings({ layoutMode });
  const setTTSSettings = (ttsSettings: Partial<IReaderSettings['ttsSettings']>) => {
    const currentTTS = settings.ttsSettings || DEFAULT_SETTINGS.ttsSettings;
    updateSettings({ ttsSettings: { ...currentTTS, ...ttsSettings } as any });
  };

  return {
    settings,
    updateSettings,
    setTheme,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setParagraphSpacing,
    setMaxWidth,
    setTextAlign,
    setLayoutMode,
    setTTSSettings,
  };
}
