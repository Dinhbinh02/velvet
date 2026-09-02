import React from 'react';
import {
  Library,
  Compass,
  List,
  Sparkles,
  Search,
  Headphones,
  Waves,
  Type,
  Cloud,
  Smartphone,
  User,
  PanelLeftClose,
  PanelLeft,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import type { IBook } from '@/src/types/book';

export type ViewMode = 'shelf' | 'reader' | 'discover';

interface AppSidebarProps {
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  booksCount: number;
  activeBook: IBook | null;
  currentChapterTitle?: string;
  currentPercentage?: number;
  onOpenSidebarTOC: () => void;
  onOpenKeyInsights: () => void;
  onOpenInBookSearch: () => void;
  onToggleTTS: () => void;
  isTTSActive: boolean;
  onOpenAmbient: () => void;
  isAmbientPlaying: boolean;
  onOpenSettings: (section?: string) => void;
  onOpenSync: () => void;
  onOpenPwa: () => void;
  onBackToLibrary: () => void;
  onAddBookClick?: () => void;
  supabaseUser?: any;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  viewMode,
  onSelectViewMode,
  isOpen,
  onToggleOpen,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  booksCount,
  activeBook,
  currentChapterTitle,
  currentPercentage,
  onOpenSidebarTOC,
  onOpenKeyInsights,
  onOpenInBookSearch,
  onToggleTTS,
  isTTSActive,
  onOpenAmbient,
  isAmbientPlaying,
  onOpenSettings,
  onOpenSync,
  onOpenPwa,
  onBackToLibrary,
  onAddBookClick,
  supabaseUser,
}) => {
  const userAvatar = supabaseUser?.user_metadata?.avatar_url || supabaseUser?.user_metadata?.picture;
  const userName = supabaseUser?.user_metadata?.full_name || supabaseUser?.user_metadata?.name || supabaseUser?.email?.split('@')[0];

  const sidebarContent = (
    <aside
      className={`h-full flex flex-col bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all duration-200 select-none ${
        isOpen ? 'w-60 sm:w-64' : 'w-16'
      }`}
    >
      {/* 1. Header: Brand Logo & Desktop Collapse Toggle (No harsh divider) */}
      <div className="h-14 px-3.5 flex items-center justify-between shrink-0">
        <div
          onClick={() => {
            if (viewMode === 'reader') onBackToLibrary();
            else onSelectViewMode('shelf');
          }}
          className={`flex items-center gap-2.5 cursor-pointer overflow-hidden transition-all hover:opacity-85 ${
            !isOpen ? 'justify-center w-full' : ''
          }`}
          title="Velvet Library"
        >
          <img
            src="/icons/icon512.png"
            alt="Velvet"
            className="w-7 h-7 rounded-xl object-cover shrink-0 shadow-xs"
          />
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight truncate leading-none">
                Velvet
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                Modern Reader
              </span>
            </div>
          )}
        </div>

        {/* Desktop Collapse / Expand Button */}
        {isOpen && (
          <button
            type="button"
            onClick={onToggleOpen}
            className="hidden md:flex p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
            title="Toggle Sidebar (Cmd + B)"
            aria-label="Toggle Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Scrollable Navigation List (Clean spacing, seamless rounded items) */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-5">
        {/* Section A: Main Navigation */}
        <div className="space-y-0.5">
          {isOpen && (
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Discover
            </div>
          )}

          {/* Library Button */}
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'reader') onBackToLibrary();
              onSelectViewMode('shelf');
              onCloseMobileDrawer();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'shelf'
                ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            } ${!isOpen ? 'justify-center px-0' : ''}`}
            title="Library"
          >
            <Library className="w-4 h-4 shrink-0" />
            {isOpen && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Library</span>
                {booksCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] font-mono">
                    {booksCount}
                  </span>
                )}
              </div>
            )}
          </button>

          {/* Discover Curated Books */}
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'reader') onBackToLibrary();
              onSelectViewMode('discover');
              onCloseMobileDrawer();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'discover'
                ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            } ${!isOpen ? 'justify-center px-0' : ''}`}
            title="Discover Books"
          >
            <Compass className="w-4 h-4 shrink-0" />
            {isOpen && <span className="truncate">Discover</span>}
          </button>

          {/* Add Book Button in Sidebar */}
          {onAddBookClick && (
            <button
              type="button"
              onClick={() => {
                onAddBookClick();
                onCloseMobileDrawer();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
                !isOpen ? 'justify-center px-0' : ''
              }`}
              title="Add New Book (.epub)"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {isOpen && <span className="truncate">Add Book</span>}
            </button>
          )}
        </div>

        {/* Section B: Active Reading Context (Clean, borderless) */}
        {viewMode === 'reader' && activeBook && (
          <div className="space-y-0.5 pt-3">
            {isOpen && (
              <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate flex items-center justify-between">
                <span className="truncate">{activeBook.title}</span>
                {typeof currentPercentage === 'number' && (
                  <span className="text-[10px] font-mono text-[var(--accent-color)] ml-1">
                    {Math.round(currentPercentage * 100)}%
                  </span>
                )}
              </div>
            )}

            {/* Back to Library */}
            <button
              type="button"
              onClick={() => {
                onBackToLibrary();
                onCloseMobileDrawer();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
                !isOpen ? 'justify-center px-0' : ''
              }`}
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {isOpen && <span className="truncate">Back to Library</span>}
            </button>

            {/* Table of Contents & Notes */}
            <button
              type="button"
              onClick={() => {
                onOpenSidebarTOC();
                onCloseMobileDrawer();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
                !isOpen ? 'justify-center px-0' : ''
              }`}
              title="Table of Contents & Notes"
            >
              <List className="w-4 h-4 shrink-0" />
              {isOpen && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">Table of Contents</span>
                  {currentChapterTitle && (
                    <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[70px]">
                      {currentChapterTitle}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Chapter Key Insights */}
            <button
              type="button"
              onClick={() => {
                onOpenKeyInsights();
                onCloseMobileDrawer();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-amber-500 hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
                !isOpen ? 'justify-center px-0' : ''
              }`}
              title="Chapter Key Insights"
            >
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              {isOpen && <span className="truncate">Key Insights</span>}
            </button>

            {/* In-Book Search */}
            <button
              type="button"
              onClick={() => {
                onOpenInBookSearch();
                onCloseMobileDrawer();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
                !isOpen ? 'justify-center px-0' : ''
              }`}
              title="Search in Book"
            >
              <Search className="w-4 h-4 shrink-0" />
              {isOpen && <span className="truncate">Search in Book</span>}
            </button>

            {/* AI Text-To-Speech Reader */}
            <button
              type="button"
              onClick={() => {
                onToggleTTS();
                onCloseMobileDrawer();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isTTSActive
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              } ${!isOpen ? 'justify-center px-0' : ''}`}
              title="Listen to Book (TTS)"
            >
              <Headphones className="w-4 h-4 shrink-0" />
              {isOpen && <span className="truncate">Audio Reader</span>}
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Footer Utility Actions (Seamless, Sleek) */}
      <div className="p-2.5 space-y-0.5 shrink-0">
        {/* User Account / Sign In */}
        <button
          type="button"
          onClick={onOpenSync}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
            !isOpen ? 'justify-center px-0' : ''
          }`}
          title={supabaseUser ? `Account: ${userName || supabaseUser.email}` : 'Sign in to sync'}
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName || 'User'}
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-color)] flex items-center justify-center font-bold text-[10px] shrink-0">
              {userName?.[0]?.toUpperCase() || supabaseUser?.email?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
            </div>
          )}
          {isOpen && (
            <span className="truncate text-xs">
              {supabaseUser ? userName || supabaseUser.email : 'Sign In & Sync'}
            </span>
          )}
        </button>

        {/* Ambient Soundscapes */}
        <button
          type="button"
          onClick={onOpenAmbient}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isAmbientPlaying
              ? 'bg-[var(--accent-subtle)] text-[var(--accent-color)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
          } ${!isOpen ? 'justify-center px-0' : ''}`}
          title="Ambient Focus Sounds"
        >
          <Waves className="w-4 h-4 shrink-0" />
          {isOpen && <span className="truncate">Ambient Sounds</span>}
        </button>

        {/* Typography & Reader Appearance */}
        <button
          type="button"
          onClick={() => onOpenSettings()}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
            !isOpen ? 'justify-center px-0' : ''
          }`}
          title="Appearance & Settings"
        >
          <Type className="w-4 h-4 shrink-0" />
          {isOpen && <span className="truncate">Appearance</span>}
        </button>

        {/* Cloud Sync */}
        <button
          type="button"
          onClick={onOpenSync}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
            !isOpen ? 'justify-center px-0' : ''
          }`}
          title="Cloud Sync"
        >
          <Cloud className="w-4 h-4 shrink-0" />
          {isOpen && <span className="truncate">Cloud Sync</span>}
        </button>

        {/* PWA Install */}
        <button
          type="button"
          onClick={onOpenPwa}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
            !isOpen ? 'justify-center px-0' : ''
          }`}
          title="Install Web App"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          {isOpen && <span className="truncate">Install App</span>}
        </button>

        {/* Collapsed expand button on bottom if compact */}
        {!isOpen && (
          <button
            type="button"
            onClick={onToggleOpen}
            className="w-full flex items-center justify-center py-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
            title="Expand Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent / Collapsible Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Off-Canvas Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobileDrawer}
          />
          <div className="relative z-10 w-72 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
