'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Eye,
  X,
  Check,
  Loader2,
  FileUp,
  Plus,
  Radio,
  Download,
} from 'lucide-react';
import { useSitrepReader } from '@/hooks/useSitrepReader';

interface FileEntry {
  id: string;
  file: File;
  previewUrl: string;
  uploaded: boolean;
}

interface SitrepUploaderProps {
  shipSlug?: string;
  onClose: () => void;
}

type SaveResult =
  | { ok: true; merged: number }
  | { ok: false; error: string }
  | null;

export function SitrepUploader({ shipSlug, onClose }: SitrepUploaderProps) {
  const { result, isLoading, error, progress, readPDF, reset } = useSitrepReader();
  
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileEntry | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, [files]);

  const processFiles = (selectedFiles: File[]) => {
    setSaveResult(null);
    if (selectedFiles.length > 0) {
      // Trigger the reader hook on the dropped file to populate `result` state
      readPDF(selectedFiles[0]); 

      const newEntries = selectedFiles.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        uploaded: false,
      }));
      setFiles((prev) => [...prev, ...newEntries]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) URL.revokeObjectURL(fileToRemove.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
    // If we remove the last file, reset the hook's state
    if (files.length === 1) reset();
  };

  const handleUploadAll = async () => {
    // We rely directly on the hook's generated `result` just like your original code!
    if (!result || !shipSlug) return;

    setIsUploading(true);
    setSaveResult(null);

    try {
      // Smart payload: if result already has a timeline property, send it as-is.
      // Otherwise, wrap it in a timeline object.
      const payload = result.timeline ? result : { timeline: result };

      const res = await fetch(`/api/ships/${shipSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setSaveResult({ ok: true, merged: data.merged || 1 });

      // Visually mark all as uploaded
      setFiles((prev) => prev.map((f) => ({ ...f, uploaded: true })));
    } catch (err: any) {
      console.error('Upload failed:', err);
      setSaveResult({ ok: false, error: err?.message ?? 'Save failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitreps.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = files.filter((f) => !f.uploaded).length;

  return (
    <div className="w-full flex flex-col rounded-xl bg-[#0d0f1a] border border-[#1c2035] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden mb-2">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2035] bg-[#10121e]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-60" />
            <span className="relative inline-flex rounded-full size-2 bg-[#6cabff]" />
          </span>
          <Radio className="size-3.5 text-[#6cabff]" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b92b0] uppercase">
            Situation Report
          </span>
        </div>

        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={downloadJSON}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[#4ade80] hover:bg-[#166534]/30 border border-transparent hover:border-[#4ade80]/50 transition-all text-[10px] font-bold tracking-widest"
            >
              <Download className="size-3" />
              JSON
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a4a8a]/20 border border-[#1a4a8a]/60 text-[#6cabff] hover:bg-[#1a4a8a]/40 hover:border-[#6cabff]/50 transition-all text-[10px] font-bold tracking-widest"
          >
            {files.length === 0 ? <Upload className="size-3" /> : <Plus className="size-3" />}
            {files.length === 0 ? 'ADD' : 'MORE'}
          </button>

          <div className="w-px h-4 bg-[#1c2035]" />

          <button
            onClick={onClose}
            className="flex items-center justify-center size-6 rounded-md text-[#4a5070] hover:text-white hover:bg-[#1c2035] transition-colors"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-3 flex flex-col gap-2">
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />

        {/* Empty state (w/ Drag & Drop) */}
        {files.length === 0 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              processFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 py-7 rounded-lg border border-dashed transition-all group cursor-pointer ${
              dragging
                ? 'border-[#6cabff] bg-[#1a4a8a]/10'
                : 'border-[#1c2035] hover:border-[#1a4a8a] hover:bg-[#1a4a8a]/5'
            }`}
          >
            <div className="p-2.5 rounded-full bg-[#1a4a8a]/10 border border-[#1a4a8a]/20 group-hover:bg-[#1a4a8a]/20 transition-colors">
              <Upload className="size-4 text-[#6cabff]" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-[#6cabff]">
                {isLoading ? progress || 'Parsing PDF...' : 'Drop SITREP PDF here'}
              </p>
              <p className="text-[10px] text-[#3a4060] mt-0.5">
                {isLoading ? 'Please wait' : 'or click to browse'}
              </p>
            </div>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {files.map((fileEntry, index) => (
              <div
                key={fileEntry.id}
                className="flex items-center gap-2.5 bg-[#0a0c14] border border-[#1c2035] rounded-lg p-2.5 hover:border-[#263050] transition-colors group"
              >
                <div className="shrink-0 size-6 flex items-center justify-center rounded bg-[#1a2133] text-[#4a6090] text-[10px] font-bold tabular-nums border border-[#1c2035]">
                  {String(index + 1).padStart(2, '0')}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-[#c8cfe8] truncate leading-tight">
                    {fileEntry.file.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-[#3a4060]">
                      {(fileEntry.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    {fileEntry.uploaded ? (
                      <>
                        <span className="text-[#1c2035]">·</span>
                        <span className="text-[10px] text-[#4ade80] font-semibold flex items-center gap-0.5">
                          <Check className="size-2.5" /> LIVE
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#1c2035]">·</span>
                        <span className="text-[10px] text-[#3a4060]">PENDING</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setViewingFile(fileEntry)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded text-[#4a6090] hover:text-[#6cabff] hover:bg-[#1a2133] transition-colors"
                    title="Preview"
                  >
                    <Eye className="size-3.5" />
                  </button>

                  {!fileEntry.uploaded && !isUploading && (
                    <button
                      onClick={() => removeFile(fileEntry.id)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded text-[#4a5070] hover:text-[#f07272] hover:bg-[#2a1010] transition-colors"
                      title="Remove"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Global Error & Success Feedback */}
        {(error || saveResult) && (
          <div
            className={`px-3 py-2 mt-1 rounded-lg border text-[11px] font-medium ${
              saveResult?.ok
                ? 'bg-[#166534]/10 border-[#4ade80]/20 text-[#4ade80]'
                : 'bg-[#7f1d1d]/10 border-[#f87171]/20 text-[#f87171]'
            }`}
          >
            {error && <div>Parse Error: {error}</div>}
            {saveResult && (
              <div>
                {saveResult.ok
                  ? `✓ Timeline updated successfully`
                  : `✗ ${saveResult.error}`}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        {pendingCount > 0 && result && (
          <button
            onClick={handleUploadAll}
            disabled={isUploading || isLoading}
            className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#1a4a8a] to-[#1e3a6e] hover:from-[#1e5cb0] hover:to-[#1a4a8a] text-white transition-all text-[11px] font-bold tracking-widest disabled:opacity-40 disabled:cursor-not-allowed border border-[#1a4a8a] shadow-[0_0_20px_rgba(26,74,138,0.25)]"
          >
            {isUploading || isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileUp className="size-3.5" />
            )}
            {isUploading
              ? `TRANSMITTING…`
              : isLoading
              ? `PARSING DATA…`
              : `ADD TO TIMELINE`}
          </button>
        )}
      </div>

      {/* ── PDF Viewer Modal ── */}
      {viewingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-6">
          <div className="flex flex-col w-full max-w-5xl h-[90vh] bg-[#0d0f1a] border border-[#1c2035] rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c2035] bg-[#10121e] shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-[#1a4a8a]/15 border border-[#1a4a8a]/30 rounded-md">
                  <FileText className="size-4 text-[#6cabff]" />
                </div>
                <div>
                  <h3 className="text-[#e4e8fa] text-[13px] font-bold truncate">
                    {viewingFile.file.name}
                  </h3>
                  <p className="text-[#3a4060] text-[10px] font-medium uppercase tracking-widest mt-0.5">
                    Document Preview
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingFile(null)}
                className="flex items-center justify-center size-7 rounded-md text-[#4a5070] hover:text-white hover:bg-[#1c2035] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 bg-[#090a0f] p-2">
              <iframe
                src={`${viewingFile.previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="w-full h-full rounded-lg border border-[#1c2035]"
                title="SITREP PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}