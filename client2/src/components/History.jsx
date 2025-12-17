import React from 'react';
import { Filter, CheckCircle, XCircle, RotateCcw, BarChart2 } from 'lucide-react';

export default function History({ history, filterStatus, setFilterStatus, onViewStatistics, onRerun }) {
    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-4 md:gap-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Execution History</h2>
                    <p className="text-gray-400">Track all your test runs and results</p>
                </div>
                <div className="flex items-center gap-3">
                    <Filter size={18} className="text-gray-400" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                        <option value="all">All Status</option>
                        <option value="passed">Passed Only</option>
                        <option value="failed">Failed Only</option>
                    </select>
                </div>
            </div>

            {/* History Table with Scrollbar */}
            <div className="flex-1 overflow-y-auto">
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-gray-400 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-5">Status</th>
                                <th className="p-5">Timestamp</th>
                                <th className="p-5">Region</th>
                                <th className="p-5">Scripts</th>
                                <th className="p-5">Duration</th>
                                <th className="p-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        No history available.
                                    </td>
                                </tr>
                            ) : history.map((run, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-all">
                                    <td className="p-5">
                                        <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${run.status === 'Passed'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                            {run.status === 'Passed' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                            {run.status}
                                        </span>
                                    </td>
                                    <td className="p-5 text-gray-300 text-sm">{new Date(run.timestamp).toLocaleString()}</td>
                                    <td className="p-5">
                                        <span className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono text-sm border border-cyan-500/30 font-bold">
                                            {run.region}
                                        </span>
                                    </td>
                                    <td className="p-5 text-gray-400 text-sm truncate max-w-xs" title={run.scripts.join(', ')}>{run.scripts.join(', ')}</td>
                                    <td className="p-5 text-gray-300 text-sm font-mono font-bold">{(run.duration / 1000).toFixed(1)}s</td>
                                    <td className="p-5 flex gap-2">
                                        <button
                                            onClick={() => onViewStatistics(run.runId)}
                                            className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-bold hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                                        >
                                            <BarChart2 size={14} /> Stats
                                        </button>
                                        <button
                                            onClick={() => onRerun(run.runId)}
                                            className="px-3 py-1.5 bg-slate-700/50 text-gray-300 rounded-lg text-sm font-bold hover:bg-white/10 transition-colors flex items-center gap-1"
                                        >
                                            <RotateCcw size={14} /> Rerun
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
