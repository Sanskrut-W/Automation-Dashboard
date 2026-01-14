import React from 'react';
import { MapPin, Code2, CheckCircle, Play, Power, Monitor, Activity, Settings } from 'lucide-react';

const SCRIPT_LABELS = {
    // Legacy labels, can be moved to config later or kept as overrides
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

// Generic Input Component
const DynamicInput = ({ input, value, onChange }) => {
    return (
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-3 border border-white/5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Settings size={12} /> {input.label}
            </h3>
            <div className="flex flex-wrap gap-2">
                {input.options.map((opt) => {
                    const optValue = typeof opt === 'object' ? opt.value : opt;
                    const optLabel = typeof opt === 'object' ? opt.label : opt;
                    const isSelected = value === optValue;

                    return (
                        <button
                            key={optValue}
                            onClick={() => onChange(input.id, optValue)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected
                                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                : 'bg-slate-800/50 border-white/5 text-gray-400 hover:border-white/20'
                                }`}
                        >
                            {optLabel}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default function Dashboard({
    config, inputValues, onInputChange,
    selectedScripts, toggleScript,
    selectAllScripts, clearAllScripts, handleRun, handleStop, isRunning, logs, logsEndRef, stats,
    scriptsList
}) {
    // Helper to calculate active inputs count
    const activeInputsCount = Object.keys(inputValues).length;

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-4 md:gap-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                        {config?.projectName || 'Test Execution'}
                    </h2>
                    <p className="text-xs md:text-sm text-gray-400">Configure and run your automation tests</p>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <StatsChip label="Inputs" value={activeInputsCount} color="cyan" />
                    <StatsChip label="Scripts" value={selectedScripts.length} color="teal" />
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 flex-1 overflow-hidden">
                {/* Configuration Panel (Left) */}
                <div className="lg:col-span-5 flex flex-col gap-3 md:gap-4 overflow-y-auto lg:overflow-hidden">

                    {/* Dynamic Inputs */}
                    {config?.inputs?.map(input => (
                        <DynamicInput
                            key={input.id}
                            input={input}
                            value={inputValues[input.id]}
                            onChange={onInputChange}
                        />
                    ))}

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
                            {scriptsList.length === 0 ? (
                                <div className="text-gray-500 text-xs text-center py-4">No scripts found for this selection.</div>
                            ) : (
                                scriptsList.map(script => (
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
                                ))
                            )}
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

                {/* Right Column: Logs */}
                <div className="lg:col-span-7 flex flex-col gap-3 md:gap-4 overflow-hidden">
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
