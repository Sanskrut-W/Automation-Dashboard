import React from 'react';
import { MapPin, Code2, CheckCircle, Play, Power, Monitor, Activity } from 'lucide-react';

const REGIONS = ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'];
const SCRIPT_LABELS = {
    'buildABet': 'Build A Bet',
    'login': 'Login',
    'signUp': 'Sign Up',
    'signup': 'Sign Up',
    'myBet': 'My Bet',
    'transactionHistory': 'Transaction History',
    'swipeBet': 'Swipe Bet',
    'bookABet': 'Book A Bet',
    'footer': 'Footer',
    'betslip': 'Betslip',
    'header': 'Header',
    'betInfluencer': 'Bet Influencer',
    'betSaver': 'BetSaver',
    'feeds': 'Feeds'
};

const StatsChip = ({ label, value, color }) => (
    <div className={`px-4 py-2 rounded-xl bg-${color}-500/10 border border-${color}-500/20 flex flex-col items-center min-w-[80px]`}>
        <span className={`text-${color}-400 font-bold text-lg`}>{value}</span>
        <span className={`text-${color}-500/60 text-[10px] uppercase font-bold tracking-wider`}>{label}</span>
    </div>
);

export default function Dashboard({
    selectedRegions, selectedScripts, toggleRegion, toggleScript,
    selectAllScripts, clearAllScripts, handleRun, handleStop, isRunning, logs, logsEndRef, stats,
    suiteType, setSuiteType, scriptsList
}) {
    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-4 md:gap-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Test Execution</h2>
                    <p className="text-xs md:text-sm text-gray-400">Configure and run your automation tests</p>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <StatsChip label="Regions" value={selectedRegions.length} color="cyan" />
                    <StatsChip label="Scripts" value={selectedScripts.length} color="teal" />
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 flex-1 overflow-hidden">
                {/* Configuration Panel (Left) */}
                <div className="lg:col-span-5 flex flex-col gap-3 md:gap-4 overflow-y-auto lg:overflow-hidden">

                    {/* Region Selector */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-3 border border-white/5">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <MapPin size={12} /> Target Region
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {REGIONS.map(region => (
                                <button
                                    key={region}
                                    onClick={() => toggleRegion(region)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedRegions.includes(region)
                                        ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                        : 'bg-slate-800/50 border-white/5 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    {region}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Script Selector */}
                    <div className="flex-1 bg-slate-900/50 backdrop-blur-xl rounded-xl p-3 border border-white/5 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Code2 size={16} className="text-teal-400" />
                                Select Scripts ({selectedScripts.length}/{scriptsList.length})
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => selectAllScripts(scriptsList)}
                                    className="px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold hover:bg-cyan-500/30 transition-all"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={clearAllScripts}
                                    className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-all"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5">
                            {scriptsList.map(script => (
                                <button
                                    key={script}
                                    onClick={() => toggleScript(script)}
                                    className={`w-full px-3 py-2 rounded-lg text-left font-medium text-xs transition-all flex items-center justify-between ${selectedScripts.includes(script)
                                        ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 text-white'
                                        : 'bg-slate-800/30 text-gray-400 hover:bg-slate-700/50 border border-white/5'
                                        }`}
                                >
                                    <span>{SCRIPT_LABELS[script] || script}</span>
                                    {selectedScripts.includes(script) && (
                                        <CheckCircle size={14} className="text-cyan-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleRun}
                            disabled={isRunning}
                            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg relative overflow-hidden group ${isRunning
                                ? 'bg-gray-700 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:shadow-2xl hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                        >
                            {isRunning ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Executing...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" fill="currentColor" />
                                    Run
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleStop}
                            disabled={!isRunning}
                            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${!isRunning
                                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                                : 'bg-red-600 hover:bg-red-700 hover:shadow-xl active:scale-[0.98] text-white'
                                }`}
                        >
                            <Power className="w-4 h-4" />
                            Stop
                        </button>
                    </div>
                </div>

                {/* Right Column: Suite Selector + Logs */}
                <div className="lg:col-span-7 flex flex-col gap-3 md:gap-4 overflow-hidden">

                    {/* Test Suite Selector (Moved Here) */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-3 border border-white/5 flex items-center justify-between gap-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                            <Monitor size={14} /> Test Suite
                        </h3>
                        <div className="flex-1 flex bg-slate-800/50 rounded-lg p-1 border border-white/5 max-w-sm">
                            <button
                                onClick={() => setSuiteType('smoke')}
                                className={`flex-1 py-1 px-3 rounded-md text-xs font-bold transition-all ${suiteType === 'smoke'
                                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Smoke
                            </button>
                            <button
                                onClick={() => setSuiteType('regression')}
                                className={`flex-1 py-1 px-3 rounded-md text-xs font-bold transition-all ${suiteType === 'regression'
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Regression
                            </button>
                        </div>
                    </div>

                    {/* Logs Panel */}
                    <div className="flex-1 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-[300px]">
                        <div className="bg-slate-800/50 px-4 py-3 border-b border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                                    <Activity size={14} className="text-emerald-400" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-white block">Console Output</span>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                            </div>
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar bg-slate-950/50 font-mono text-xs">
                            {logs.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    <div className="text-center">
                                        <Activity size={32} className="mx-auto mb-2 opacity-30" />
                                        <p>No logs yet. Run a test to see output.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {logs.map((log, idx) => (
                                        <div key={idx} className={`${log.type === 'stderr' ? 'text-red-400' : 'text-gray-300'} break-words`}>
                                            <span className="text-gray-600 mr-2 opacity-70">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                            {log.data}
                                        </div>
                                    ))}
                                    <div ref={logsEndRef} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
