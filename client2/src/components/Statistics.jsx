import React from 'react';
import { BarChart2, RefreshCw, CheckCircle, XCircle, Clock, ListChecks } from 'lucide-react';
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

const labelFor = (script) => SCRIPT_LABELS[script] || script;

const PASS_COLOR = '#34d399';
const FAIL_COLOR = '#f87171';

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
    const perScriptResults = run.perScriptResults || [];
    const totalTests = run.totalTests ?? 0;
    const totalPassed = run.totalPassed ?? 0;
    const totalFailed = run.totalFailed ?? 0;
    const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    const durationSec = run.duration ? (run.duration / 1000).toFixed(1) : '0.0';

    const barData = perScriptResults.map(s => ({
        name: labelFor(s.scriptName),
        Passed: s.passed,
        Failed: s.failed
    }));

    const pieData = [
        { name: 'Passed', value: totalPassed },
        { name: 'Failed', value: totalFailed }
    ].filter(d => d.value > 0);

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-4 md:gap-6 overflow-y-auto relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Execution Statistics</h2>
                    <p className="text-gray-400 text-sm">
                        Run {run.runId} &middot; {run.timestamp ? new Date(run.timestamp).toLocaleString() : 'Unknown time'}
                    </p>
                </div>
                {isViewingHistorical && (
                    <button
                        onClick={onBackToLatest}
                        className="px-4 py-2 bg-slate-900/90 text-cyan-400 rounded-xl font-bold border border-white/10 shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} />
                        Back to Latest
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<ListChecks size={22} />} label="Total Tests" value={totalTests} color="cyan" />
                <StatCard icon={<CheckCircle size={22} />} label="Passed" value={totalPassed} color="emerald" />
                <StatCard icon={<XCircle size={22} />} label="Failed" value={totalFailed} color="red" />
                <StatCard icon={<Clock size={22} />} label="Duration" value={`${durationSec}s`} color="amber" />
            </div>

            {perScriptResults.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    No per-script results found for this run.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                    <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-4 md:p-6">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Results by Script</h3>
                        <ResponsiveContainer width="100%" height={Math.max(240, barData.length * 40)}>
                            <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" allowDecimals={false} stroke="rgba(255,255,255,0.4)" />
                                <YAxis type="category" dataKey="name" width={140} stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                                <Legend />
                                <Bar dataKey="Passed" stackId="a" fill={PASS_COLOR} />
                                <Bar dataKey="Failed" stackId="a" fill={FAIL_COLOR} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-4 md:p-6 flex flex-col items-center">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 self-start">Overall Result</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                                    {pieData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.name === 'Passed' ? PASS_COLOR : FAIL_COLOR} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        <p className="text-2xl font-bold text-white mt-2">{successRate}%</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Success Rate</p>
                    </div>
                </div>
            )}
        </div>
    );
}
