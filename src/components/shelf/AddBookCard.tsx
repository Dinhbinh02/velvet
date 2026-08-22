import React, { useState, useRef } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { BookService } from '@/src/services/bookService';

interface AddBookCardProps {
  onBookImported?: (bookId: string) => void;
}

export const AddBookCard: React.FC<AddBookCardProps> = ({ onBookImported }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      setErrorMsg('Please select a valid .epub file format.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    try {
      setIsImporting(true);
      setErrorMsg(null);
      const bookId = await BookService.importBook(file);
      if (onBookImported) {
        onBookImported(bookId);
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      setErrorMsg(err.message || 'Unable to import EPUB file.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col space-y-2.5 group relative select-none h-full">
      {/* 2:3 Aspect ratio card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative aspect-[2/3] w-full rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-4 text-center group-hover:-translate-y-1 ${
          isDragging
            ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)] shadow-md'
            : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/40 hover:border-[var(--accent-color)] hover:bg-[var(--bg-secondary)]/80 hover:shadow-md'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        {isImporting ? (
          <div className="flex flex-col items-center gap-2 text-[var(--accent-color)] animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[11px] font-semibold text-[var(--text-primary)]">Importing...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] group-hover:border-[var(--accent-color)]/40 shadow-xs transition-all">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-[var(--text-primary)] leading-tight">Add Book</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Drop .epub here</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="absolute inset-x-2 bottom-2 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] leading-tight font-medium">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Footer text matching BookCard height and spacing */}
      <div className="space-y-1 px-0.5 text-left">
        <div className="flex items-start justify-between gap-1">
          <h4 className="font-bold text-xs leading-snug line-clamp-2 text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors">
            Import EPUB
          </h4>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] truncate">
          From computer
        </p>
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] pt-0.5 opacity-0">
          <span>Placeholder</span>
        </div>
      </div>
    </div>
  );
};
