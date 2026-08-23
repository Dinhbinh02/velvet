import React, { useEffect, useState, useRef } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Zap,
  Radio,
} from 'lucide-react';
import { SupabaseService } from '@/src/services/supabaseClient';
import { SupabaseSyncService } from '@/src/services/supabaseSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSession();
    }
  }, [isOpen]);

  const loadSession = async () => {
    try {
      const sUser = await SupabaseService.getCurrentUser();
      setSupabaseUser(sUser);
    } catch {}
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setStatusMessage(null);
    try {
      const { error } = await SupabaseService.signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Google sign-in failed.' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    setIsAuthLoading(true);
    setStatusMessage(null);
    try {
      const { user, error } = await SupabaseService.signInWithEmail(authEmail, authPassword);
      if (error) {
        // Automatically try sign-up if user doesn't exist yet
        const { user: newUser, error: signUpErr } = await SupabaseService.signUpWithEmail(authEmail, authPassword);
        if (signUpErr) throw signUpErr;
        setSupabaseUser(newUser);
        setStatusMessage({ type: 'success', text: 'Account created & logged in!' });
      } else {
        setSupabaseUser(user);
        setStatusMessage({ type: 'success', text: 'Signed in successfully!' });
      }
      await SupabaseSyncService.syncAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Authentication failed.' });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await SupabaseService.signOut();
    setSupabaseUser(null);
    setStatusMessage({ type: 'info', text: 'Signed out.' });
  };

  const handleSyncNow = async () => {
    setIsAuthLoading(true);
    setStatusMessage({ type: 'info', text: 'Synchronizing with Velvet Cloud...' });
    const res = await SupabaseSyncService.syncAll();
    setIsAuthLoading(false);
    setStatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Velvet Cloud Sync</h3>
              <p className="text-xs text-[var(--text-secondary)]">Multi-device library & reading sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Status Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {supabaseUser ? (
            (() => {
              const userAvatar = supabaseUser?.user_metadata?.avatar_url || supabaseUser?.user_metadata?.picture;
              const userName = supabaseUser?.user_metadata?.full_name || supabaseUser?.user_metadata?.name || supabaseUser?.email?.split('@')[0];

              return (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt={userName || 'User'}
                          className="w-10 h-10 rounded-full border border-[var(--border-color)] object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center font-bold text-sm shrink-0">
                          {supabaseUser.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-[var(--text-primary)] truncate">{userName || supabaseUser.email}</p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{supabaseUser.email}</p>
                        <p className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium mt-0.5">
                          <Radio className="w-2.5 h-2.5 animate-pulse" /> Realtime Sync Active
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="p-2 rounded-xl hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 transition-all cursor-pointer shrink-0"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleSyncNow}
                    disabled={isAuthLoading}
                    className="w-full py-3 px-4 rounded-2xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    <span>Sync Library Now</span>
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
                <h4 className="font-bold text-xs text-[var(--text-primary)]">Sign in to your account</h4>

                <form onSubmit={handleEmailSignIn} className="space-y-2.5">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign In / Sign Up</span>}
                  </button>
                </form>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-[var(--border-color)] w-full"></div>
                  <span className="bg-[var(--bg-secondary)] px-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider">or</span>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
