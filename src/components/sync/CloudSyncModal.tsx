import React, { useEffect, useState, useRef } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  User,
  HardDrive,
} from 'lucide-react';
import { GoogleAuthService, type IGoogleUserInfo } from '@/src/services/googleAuthService';
import { GoogleDriveSyncService, type ISyncMetadata } from '@/src/services/googleDriveSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const [user, setUser] = useState<IGoogleUserInfo | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncMeta, setSyncMeta] = useState<ISyncMetadata | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSession();
    }
  }, [isOpen]);

  const loadSession = async () => {
    setIsLoadingUser(true);
    try {
      const currentUser = await GoogleAuthService.getCurrentUser();
      setUser(currentUser);
      const meta = await GoogleDriveSyncService.getLastSyncInfo();
      setSyncMeta(meta);
    } catch {}
    setIsLoadingUser(false);
  };

  const handleSignIn = async () => {
    setIsLoadingUser(true);
    setStatusMessage(null);
    try {
      await GoogleAuthService.getAccessToken(true);
      const profile = await GoogleAuthService.fetchUserInfo();
      setUser(profile);
      const meta = await GoogleDriveSyncService.getLastSyncInfo();
      setSyncMeta(meta);
      setStatusMessage({ type: 'success', text: `Welcome back, ${profile?.name || 'Reader'}!` });
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Google Sign-In was cancelled or failed.' });
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoadingUser(true);
    setStatusMessage(null);
    try {
      await GoogleAuthService.signOut();
      setUser(null);
      setSyncMeta(null);
      setStatusMessage({ type: 'info', text: 'Signed out of Google account.' });
    } catch (err: any) {
      console.error('Sign out error:', err);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleBackup = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      await GoogleDriveSyncService.backupNow();
      const meta = await GoogleDriveSyncService.getLastSyncInfo();
      setSyncMeta(meta);
      setStatusMessage({ type: 'success', text: 'Library successfully backed up to Google Drive!' });
    } catch (err: any) {
      console.error('Backup failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Backup failed. Please check your connection.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Restore will merge saved books, notes, and highlights from Google Drive. Continue?')) {
      return;
    }
    setIsRestoring(true);
    setStatusMessage(null);
    try {
      const res = await GoogleDriveSyncService.restoreNow();
      setStatusMessage({ type: 'success', text: `Restored ${res.restoredCount} items from Google Drive!` });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Restore failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Restore failed. No backup found.' });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Google Cloud Sync</h3>
              <p className="text-xs text-[var(--text-secondary)]">Backup library & sync across devices</p>
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
        <div className="p-6 space-y-5 flex-1">
          {/* Status Message Notification */}
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

          {/* Account Profile Card */}
          {user ? (
            <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border border-[var(--border-color)] shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-xs text-[var(--text-primary)] truncate">{user.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={isLoadingUser}
                className="p-2 rounded-xl hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[var(--text-primary)]">Connect Google Drive</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Sign in with Google to backup books, notes & reading progress.</p>
              </div>
              <button
                onClick={handleSignIn}
                disabled={isLoadingUser}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoadingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign in with Google</span>}
              </button>
            </div>
          )}

          {/* Sync Stats & Quick Actions */}
          {user && (
            <div className="space-y-3">
              {syncMeta && (
                <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <HardDrive className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    <span>Last Cloud Backup:</span>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {new Date(syncMeta.lastSyncAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleBackup}
                  disabled={isSyncing || isRestoring}
                  className="p-3.5 rounded-2xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                  <span>Backup to Drive</span>
                </button>

                <button
                  onClick={handleRestore}
                  disabled={isSyncing || isRestoring}
                  className="p-3.5 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold shadow-sm transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4 text-[var(--accent-color)]" />}
                  <span>Restore from Drive</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
