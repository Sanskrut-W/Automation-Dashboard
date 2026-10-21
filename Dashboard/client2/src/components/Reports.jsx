import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
    FileText, Camera, Download, ArrowLeft, RotateCw, Home,
    FolderOpen, ChevronDown, ChevronRight, RefreshCw, FolderSymlink
} from 'lucide-react';

export default function Reports({ reportKey, selectedProject, batch }) {
    const projectId = selectedProject?.id || 'synapse';
    const reportUrl = `/report/${projectId}/index.html?t=${reportKey}`;

    const iframeRef = useRef(null);
    const [frameKey, setFrameKey] = useState(reportKey);
    const [showArchive, setShowArchive] = useState(false);
    const [batches, setBatches] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [loadingArchive, setLoadingArchive] = useState(false);

    useEffect(() => setFrameKey(reportKey), [reportKey]);

    const loadBatches = useCallback(() => {
        setLoadingArchive(true);
        axios.get(`/api/report-batches?project=${projectId}`)
            .then(res => setBatches(res.data || []))
            .catch(err => console.error('Failed to load saved reports:', err))
            .finally(() => setLoadingArchive(false));
    }, [projectId]);

    useEffect(() => {
        if (showArchive) loadBatches();
    }, [showArchive, loadBatches]);

    // Refresh the folder list when a batch finishes, so its PDFs show up straight away.
    useEffect(() => {
        if (batch?.finished && showArchive) loadBatches();
    }, [batch?.finished, batch?.batchId, showArchive, loadBatches]);

    // The Playwright report navigates away from itself when you open a screenshot or
    // trace attachment, and it draws no back control of its own — so provide one.
    const goBack = () => {
        try {
            iframeRef.current?.contentWindow?.history.back();
        } catch (e) {
            // Blocked for some reason — fall back to reloading the report root.
            setFrameKey(Date.now());
        }
    };

    const goHome = () => setFrameKey(Date.now());

    const reload = () => {
        try {
            iframeRef.current?.contentWindow?.location.reload();
        } catch (e) {
            setFrameKey(Date.now());
        }
    };

    const openFolder = (name) => {
        axios.post(`/api/report-batches/${encodeURIComponent(name)}/open`)
            .catch(err => alert('Could not open folder: ' + (err.response?.data?.error || err.message)));
    };

    const btn = 'px-3 py-2 bg-slate-800 border border-white/10 hover:bg-slate-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95';

    return (
        <div className="flex-1 w-full h-full bg-slate-950 relative flex flex-col overflow-hidden">
            <div className="bg-slate-900 border-b border-white/10 p-3 md:p-4 flex flex-wrap justify-between items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Report navigation */}
                    <button onClick={goBack} className={btn} title="Back to the report (after opening a screenshot or trace)">
                        <ArrowLeft size={15} className="text-cyan-400" /> Back
                    </button>
                    <button onClick={goHome} className={btn} title="Jump back to the report overview">
                        <Home size={15} className="text-cyan-400" />
                    </button>
                    <button onClick={reload} className={btn} title="Reload the report">
                        <RotateCw size={15} className="text-cyan-400" />
                    </button>

                    <h2 className="ml-2 text-sm md:text-base font-bold text-white hidden sm:flex items-center gap-2">
                        <FileText size={18} className="text-cyan-400" />
                        {selectedProject?.name || 'Project'} — Playwright Report
                    </h2>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowArchive(v => !v)}
                        className={`${btn} ${showArchive ? 'border-cyan-500/50 text-cyan-300' : ''}`}
                        title="Browse the PDF reports saved by each run"
                    >
                        <FolderOpen size={15} className="text-amber-400" /> Saved Reports
                        {showArchive ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <button
                        onClick={() => window.open(`/api/report/screenshots?project=${projectId}`, '_blank')}
                        className={btn}
                    >
                        <Camera size={15} className="text-red-400" /> Failed Screenshots
                    </button>
                    <button
                        onClick={() => window.open(`/api/report/pdf?project=${projectId}`, '_blank')}
                        className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:shadow-lg hover:shadow-cyan-500/30 text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Download size={15} /> Save as PDF
                    </button>
                </div>
            </div>

            {/* Saved report folders — one folder per run, one PDF per region inside */}
            {showArchive && (
                <div className="bg-slate-900/80 border-b border-white/10 max-h-72 overflow-y-auto custom-scrollbar shrink-0">
                    <div className="flex items-center justify-between px-4 py-2 sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            Saved report folders ({batches.length})
                        </span>
                        <button onClick={loadBatches} className="text-gray-400 hover:text-white transition-colors" title="Refresh">
                            <RefreshCw size={14} className={loadingArchive ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {batches.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">
                            {loadingArchive ? 'Loading…' : 'No saved reports yet — run a suite to create one.'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {batches.map(b => (
                                <li key={b.name}>
                                    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/5 transition-colors">
                                        <button
                                            onClick={() => setExpanded(expanded === b.name ? null : b.name)}
                                            className="flex-1 flex items-center gap-2 text-left min-w-0"
                                        >
                                            {expanded === b.name
                                                ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                                                : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
                                            <FolderOpen size={14} className="text-amber-400 shrink-0" />
                                            <span className="font-mono text-xs text-gray-200 truncate">{b.name}</span>
                                            <span className="text-[10px] text-gray-500 shrink-0">
                                                {b.files.length} PDF{b.files.length === 1 ? '' : 's'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => openFolder(b.name)}
                                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                            title="Open this folder on disk"
                                        >
                                            <FolderSymlink size={14} />
                                        </button>
                                        <a
                                            href={`/api/report-batches/${encodeURIComponent(b.name)}/download`}
                                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                            title="Download the whole folder as a zip"
                                        >
                                            <Download size={14} />
                                        </a>
                                    </div>

                                    {expanded === b.name && (
                                        <div className="px-4 pb-3 pl-10 flex flex-wrap gap-1.5">
                                            {b.files.length === 0 ? (
                                                <span className="text-[11px] text-gray-500">No PDFs in this folder.</span>
                                            ) : b.files.map(f => (
                                                <a
                                                    key={f.file}
                                                    href={`/api/report-batches/${encodeURIComponent(b.name)}/files/${encodeURIComponent(f.file)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-white/10 hover:border-cyan-500/50 text-[11px] font-bold text-gray-300 hover:text-cyan-300 flex items-center gap-1.5 transition-all"
                                                    title={`${f.file} — ${Math.round(f.size / 1024)} KB`}
                                                >
                                                    <FileText size={11} className="text-cyan-400" /> {f.file}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="flex-1 relative w-full bg-white">
                <iframe
                    id="report-iframe"
                    ref={iframeRef}
                    key={frameKey}
                    src={reportUrl}
                    className="w-full h-full border-none"
                    title="Playwright Report"
                ></iframe>
            </div>
        </div>
    );
}
