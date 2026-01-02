import React, { useState } from 'react';
import type { UseExportLogResult } from '../../hooks/useExportLog';
import { exportLogService } from '../../api/services';
import type { ExportLog } from '../../types';
import { 
  ActionBar, 
  Card, 
  Button,
  ConfirmModal
} from '../common';

interface ExportHistoryViewProps {
  exportLogHook: UseExportLogResult;
}

export const ExportHistoryView: React.FC<ExportHistoryViewProps> = ({
  exportLogHook
}) => {
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExportLog | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const handleDownload = async (log: ExportLog) => {
    try {
      await exportLogService.downloadLog(log.id);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handlePreview = async (log: ExportLog) => {
    setIsPreviewLoading(true);
    try {
      const content = await exportLogService.getPreview(log.id);
      setPreviewContent(content);
      setExpandedLogId(log.id);
    } catch (err) {
      console.error('Preview failed', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const success = await exportLogHook.deleteLog(confirmDelete.id);
    if (success) {
      setConfirmDelete(null);
      if (expandedLogId === confirmDelete.id) setExpandedLogId(null);
    }
  };

  const handleClearAll = async () => {
    const success = await exportLogHook.clearAllLogs();
    if (success) {
      setShowClearAllConfirm(false);
      setExpandedLogId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
      <ActionBar
        title="Export Archives"
        subtitle="Full history of generated manifests"
        actions={
          <div className="flex gap-6 items-center">
            {exportLogHook.exportLogs.length > 0 && (
                <Button 
                    variant="danger" 
                    size="sm"
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    onClick={() => setShowClearAllConfirm(true)}
                    isLoading={exportLogHook.isDeleting && showClearAllConfirm}
                >
                    Clear History
                </Button>
            )}
            <div className="text-right">
                <div className="text-2xl font-black text-indigo-400">
                {exportLogHook.exportLogs.length}
                </div>
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                Total Exports
                </div>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 pb-20">
        {exportLogHook.exportLogs.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
            <p className="text-slate-600 font-bold">No exports recorded yet.</p>
          </div>
        ) : (
          exportLogHook.exportLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            
            return (
              <Card
                key={log.id}
                variant={isExpanded ? 'default' : 'subtle'}
                className={`group ${isExpanded ? 'ring-2 ring-indigo-500/50' : ''}`}
              >
                <div className="flex flex-col gap-4 p-5 sm:p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                      {/* Desktop only icon */}
                      <div className={`hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center shrink-0 transition-colors ${
                        isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'
                      }`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-black text-white mb-1 truncate pr-4 uppercase tracking-tight">
                          {log.filename}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                          <span className="shrink-0">{new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                          <span className="w-1 h-1 bg-slate-800 rounded-full hidden sm:block"></span>
                          <span className="shrink-0 opacity-60">{log.count} Rows</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 sm:ml-auto">
                       {/* Preview hidden on mobile */}
                       <Button
                        variant="ghost"
                        size="sm"
                        className="hidden sm:flex py-2 px-3"
                        onClick={() => handlePreview(log)}
                        isLoading={isPreviewLoading && expandedLogId === log.id}
                      >
                        {isExpanded ? 'Refresh' : 'Preview'}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 sm:flex-none py-3 px-6 h-12 sm:h-auto rounded-2xl sm:rounded-xl shadow-lg shadow-indigo-500/10"
                        onClick={() => handleDownload(log)}
                      >
                        Download
                      </Button>
                      <button 
                        onClick={() => setConfirmDelete(log)}
                        className="w-12 h-12 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 rounded-2xl sm:rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-slate-800 sm:border-none group/del"
                      >
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 group-hover/del:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && previewContent && (
                    <div className="mt-4 p-6 bg-slate-950 rounded-2xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Content Snapshot</h4>
                            <button onClick={() => setExpandedLogId(null)} className="text-slate-500 hover:text-white text-xs font-bold uppercase">Close</button>
                        </div>
                        <pre className="text-[11px] font-mono text-slate-400 overflow-x-auto p-4 bg-slate-900/50 rounded-xl leading-relaxed max-h-60 overflow-y-auto thin-scrollbar">
                            {previewContent}
                        </pre>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Remove Export Record?"
        message={<>Are you sure you want to delete the record for <span className="text-white font-bold">{confirmDelete?.filename}</span>? This will only remove the log, not any files you have already downloaded.</>}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        isLoading={exportLogHook.isDeleting}
        variant="danger"
      />

      <ConfirmModal 
        isOpen={showClearAllConfirm}
        title="Clear Export History?"
        message="Are you sure you want to permanently delete all export records? This action cannot be undone."
        confirmLabel="Wipe History"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearAllConfirm(false)}
        isLoading={exportLogHook.isDeleting}
        variant="danger"
      />
    </div>
  );
};
