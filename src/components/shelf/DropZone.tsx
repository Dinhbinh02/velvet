import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { BookService } from '@/src/services/bookService';

interface DropZoneProps {
  onBookImported?: (bookId: string) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onBookImported }) => {
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
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative p-4 rounded-xl border border-dashed transition-all cursor-pointer select-none flex items-center justify-center gap-3 ${
        isDragging
          ? 'border-[var(--accent-color)] bg-[var(--accent-subtle)]'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--accent-color)]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,application/epub+zip"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-color)] shrink-0">
        {isImporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UploadCloud className="w-4 h-4" />
        )}
      </div>

      <div className="text-left">
        <p className="text-xs font-semibold text-[var(--text-primary)]">
          {isImporting ? 'Processing EPUB...' : 'Add Book to Library'}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          Drag & drop .epub file here or browse
        </p>
      </div>

      {errorMsg && (
        <div className="absolute inset-x-2 bottom-1 text-[10px] text-red-500 font-medium text-center">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
