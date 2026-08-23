import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle, Sparkles, BookOpen, Apple } from 'lucide-react';

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>('ios');
  const [isStandalone, setIsStandalone] = useState(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  useEffect(() => {
    // Check if app is already running as standalone PWA
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS devices & default to iOS tab on Apple devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod|macintosh/.test(userAgent);
    if (isIosDevice) {
      setActiveTab('ios');
    } else {
      setActiveTab('android');
    }

    // Listen for Android / Chrome PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalledSuccessfully(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-2xl text-[var(--text-primary)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center text-[var(--accent-color)] shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)]">
                PWA Mobile App
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Install Velvet App
            </h3>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        {!isStandalone && !installedSuccessfully && (
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] p-1 rounded-2xl mb-4">
            <button
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Apple className="w-3.5 h-3.5" />
              <span>iPhone / iPad</span>
            </button>
            <button
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android / PC</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        {isStandalone || installedSuccessfully ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-base text-[var(--text-primary)]">
              App Ready on Home Screen
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Velvet is running as a standalone mobile application with full offline caching and local storage.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-2xl bg-[var(--accent-color)] text-[var(--bg-primary)] font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Continue Reading
            </button>
          </div>
        ) : activeTab === 'ios' ? (
          <div className="space-y-3.5">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Install Velvet on your iPhone or iPad for a borderless Apple Books reading experience with offline access:
            </p>

            <div className="space-y-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-3.5 text-left">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-color)]/20 text-[var(--accent-color)] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    Tap the Share button <Share className="w-3.5 h-3.5 text-[var(--accent-color)] inline" />
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    At the bottom bar in Safari (or top bar on iPad).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-color)]/20 text-[var(--accent-color)] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    Select <span className="font-bold text-[var(--accent-color)]">"Add to Home Screen"</span> <PlusSquare className="w-3.5 h-3.5 text-[var(--accent-color)] inline" />
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Scroll down in the share sheet and tap Add.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-color)]/20 text-[var(--accent-color)] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[var(--text-primary)]">
                    Launch Velvet from Home Screen
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Enjoy distraction-free, full-screen reading anytime.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-[var(--accent-color)] text-[var(--bg-primary)] font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              Got It
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Install Velvet on your Android device or PC to read your library offline with maximum smoothness:
            </p>

            <div className="space-y-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-3.5 text-xs text-[var(--text-secondary)] text-left">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                <span>100% Offline book reading and annotations</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                <span>Distraction-free, borderless full screen</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                <span>Instant startup with local storage</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button
                onClick={deferredPrompt ? handleNativeInstall : onClose}
                className="flex-1 py-2.5 rounded-2xl bg-[var(--accent-color)] text-[var(--bg-primary)] font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Install</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
