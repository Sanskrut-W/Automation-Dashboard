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

    // Construct URL for the run-specific Allure Report
    // Route /source/ maps to automation repo src/
    const reportUrl = `/source/regions/${run.region}/reports/allure-reports/${run.runId}/index.html`;

    return (
        <div className="flex-1 flex flex-col p-0 overflow-hidden relative">
            {/* Header Overlay (optional, or kept above) */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
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

            {/* Allure Report Iframe */}
            <div className="flex-1 w-full h-full bg-white">
                <iframe
                    src={reportUrl}
                    className="w-full h-full border-none"
                    title={`Allure Report - ${run.runId}`}
                    onError={(e) => console.error("Failed to load iframe", e)}
                />
            </div>
        </div>
    );
}
