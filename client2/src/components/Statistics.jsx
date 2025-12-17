import React from 'react';
import { BarChart2, RefreshCw, Code2, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

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

const StatCard = ({ icon, label, value, color }) => (
    <div className={`p-4 rounded-xl bg-slate-900/50 backdrop-blur-sm border border-white/5 flex items-center gap-4`}>
        <div className={`w-12 h-12 rounded-lg bg-${color}-500/10 flex items-center justify-center text-${color}-400`}>
            {icon}
        </div>
        <div>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-xl md:text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

export default function Statistics({ run, latestRun, onBackToLatest }) {
    if (!run) {
        return (
            <div className="flex-1 flex items-center justify-center p-4 md:p-8">
                <div className="text-center">
                    <BarChart2 size={64} className="mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">No Execution Data</h3>
                    <p className="text-sm md:text-base text-gray-400">Run a test to see statistics</p>
                </div>
            </div>
        );
    }

    const isViewingHistorical = run.runId !== latestRun?.runId;

    // Prepare chart data from per-script results
    const scriptCoverageData = (run.perScriptResults || []).map(script => ({
        name: SCRIPT_LABELS[script.scriptName] || script.scriptName,
        passed: script.passed,
        failed: script.failed
    }));

    const statusData = [
        { name: 'Passed', value: run.totalPassed || 0, color: '#10b981' },
        { name: 'Failed', value: run.totalFailed || 0, color: '#ef4444' }
    ];

    const durationData = (run.perScriptResults || []).map(script => ({
        name: SCRIPT_LABELS[script.scriptName] || script.scriptName,
        duration: Math.round(script.duration / 1000) // Convert to seconds
    }));

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-4 md:gap-6 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Execution Statistics</h2>
                    <p className="text-xs md:text-sm text-gray-400">Detailed metrics for Run #{run.runId}</p>
                </div>
                {isViewingHistorical && (
                    <button
                        onClick={onBackToLatest}
                        className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} />
                        Back to Latest
                    </button>
                )}
            </div>

            {/* Run Metadata */}
            <div className="flex items-center gap-4 mt-4">
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500">Run ID</p>
                    <p className="text-sm font-mono font-bold text-white">{run.runId}</p>
                </div>
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500">Timestamp</p>
                    <p className="text-sm font-bold text-white">{new Date(run.timestamp).toLocaleString()}</p>
                </div>
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500">Region</p>
                    <p className="text-sm font-bold text-cyan-400">{run.region}</p>
                </div>
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="text-sm font-bold text-white">{(run.duration / 1000).toFixed(1)}s</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard icon={<Code2 />} label="Total Test Cases" value={run.totalTests || 0} color="cyan" />
                <StatCard icon={<CheckCircle />} label="Passed Tests" value={run.totalPassed || 0} color="emerald" />
                <StatCard icon={<XCircle />} label="Failed Tests" value={run.totalFailed || 0} color="red" />
                <StatCard icon={<TrendingUp />} label="Success Rate" value={`${run.successRate || 0}%`} color="teal" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Script Execution Coverage - Stacked Bar */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Script Execution Coverage</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={scriptCoverageData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                            <Legend />
                            <Bar dataKey="passed" stackId="a" fill="#10b981" name="Passed" />
                            <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pass/Fail Distribution */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4">Pass/Fail Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Absolute Numbers */}
                    <div className="flex justify-center gap-6 mt-4">
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Total Passed</p>
                            <p className="text-2xl font-bold text-emerald-400">{run.totalPassed || 0}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Total Failed</p>
                            <p className="text-2xl font-bold text-red-400">{run.totalFailed || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Execution Duration per Script */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Execution Duration (Per Script)</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={durationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
                        <YAxis stroke="#94a3b8" label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        <Bar dataKey="duration" fill="#4ecdc4" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

        </div>
    );
}
