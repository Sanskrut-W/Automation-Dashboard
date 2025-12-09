import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import {
  Play, FileText, BarChart2, Clock, Monitor, CheckCircle, XCircle,
  Rocket, Activity, TrendingUp, Code2, Server, Filter, Download,
  RefreshCw, Zap, AlertCircle, ChevronDown, X, Menu
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const socket = io();

const REGIONS = ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'];
const ALL_SCRIPTS = [
  'buildABet', 'login', 'signUp', 'myBet', 'transactionHistory',
  'swipeBet', 'bookABet', 'footer', 'betslip', 'header',
  'betInfluencer', 'betSaver'
];

const SCRIPT_LABELS = {
  'buildABet': 'Build A Bet',
  'login': 'Login',
  'signUp': 'Sign Up',
  'myBet': 'My Bet',
  'transactionHistory': 'Transaction History',
  'swipeBet': 'Swipe Bet',
  'bookABet': 'Book A Bet',
  'footer': 'Footer',
  'betslip': 'Betslip',
  'header': 'Header',
  'betInfluencer': 'Bet Influencer',
  'betSaver': 'BetSaver'
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRegions, setSelectedRegions] = useState(['ZA']);
  const [selectedScripts, setSelectedScripts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [latestRun, setLatestRun] = useState(null); // Latest execution run for Statistics
  const [currentViewingRun, setCurrentViewingRun] = useState(null); // Specific run being viewed
  const [reportKey, setReportKey] = useState(Date.now()); // Force iframe refresh
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu state
  const logsEndRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    fetchLatestRun();

    socket.on('execution:start', (data) => {
      console.log('📡 Received execution:start', data);
      setIsRunning(true);
      setCurrentRunId(data.runId);
      setLogs([]);
    });

    socket.on('execution:log', (data) => {
      setLogs(prev => [...prev, { type: data.type, data: data.data, timestamp: new Date() }]);
    });

    socket.on('execution:end', (data) => {
      console.log('📡 Received execution:end', data);
      setIsRunning(false);
      fetchHistory();
      fetchLatestRun(); // Update latest run after execution
      if (data.results) {
        setLatestRun(data.results); // Update immediately with results
      }
      // Force report iframe to refresh with new report
      setReportKey(Date.now());
    });

    socket.on('execution:stopped', (data) => {
      console.log('📡 Received execution:stopped', data);
      setIsRunning(false);
      setLogs(prev => [...prev, { type: 'info', data: `\n⚠️ ${data.message}\n`, timestamp: new Date() }]);
    });

    return () => {
      socket.off('execution:start');
      socket.off('execution:log');
      socket.off('execution:end');
      socket.off('execution:stopped');
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchHistory = () => {
    axios.get('/api/history')
      .then(res => setHistory(res.data))
      .catch(err => console.error(err));
  };

  const fetchLatestRun = () => {
    axios.get('/api/runs/latest')
      .then(res => {
        setLatestRun(res.data);
        // If not viewing a specific run, show latest
        if (!currentViewingRun) {
          setCurrentViewingRun(res.data);
        }
      })
      .catch(err => {
        if (err.response?.status !== 404) {
          console.error('Error fetching latest run:', err);
        }
      });
  };

  const viewRunStatistics = (runId) => {
    axios.get(`/api/runs/${runId}`)
      .then(res => {
        setCurrentViewingRun(res.data);
        setActiveTab('stats');
      })
      .catch(err => alert('Failed to load run: ' + err.message));
  };

  const handleRerun = (runId) => {
    if (!confirm('Are you sure you want to rerun this execution?')) return;

    axios.post(`/api/runs/${runId}/rerun`)
      .then(res => {
        console.log('Rerun started:', res.data);
        setActiveTab('dashboard'); // Switch to dashboard to see logs
      })
      .catch(err => alert('Failed to rerun: ' + err.message));
  };

  const handleStop = () => {
    axios.post('/api/stop')
      .then(res => {
        console.log('Execution stopped:', res.data);
      })
      .catch(err => {
        if (err.response?.status === 400) {
          console.log('No execution is currently running');
        } else {
          console.error('Failed to stop execution:', err.message);
        }
      });
  };

  const toggleRegion = (region) => {
    setSelectedRegions(prev =>
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  const toggleScript = (script) => {
    setSelectedScripts(prev =>
      prev.includes(script)
        ? prev.filter(s => s !== script)
        : [...prev, script]
    );
  };

  const selectAllScripts = () => {
    setSelectedScripts(ALL_SCRIPTS);
  };

  const clearAllScripts = () => {
    setSelectedScripts([]);
  };

  const handleRun = () => {
    if (selectedRegions.length === 0) return alert("Select at least one region");
    if (selectedScripts.length === 0) return alert("Select at least one script");

    axios.post('/api/execute', {
      region: selectedRegions[0], // For now, run first region
      scripts: selectedScripts
    })
      .then(res => console.log("Started", res.data))
      .catch(err => alert("Failed to start: " + err.message));
  };

  const getStats = () => {
    const total = history.length;
    const passed = history.filter(h => h.status === 'Passed').length;
    const failed = history.filter(h => h.status === 'Failed').length;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgDuration = total > 0 ? Math.round(history.reduce((acc, h) => acc + (h.duration || 0), 0) / total / 1000) : 0;

    return { total, passed, failed, successRate, avgDuration };
  };

  const stats = getStats();

  const filteredHistory = filterStatus === 'all'
    ? history
    : history.filter(h => h.status.toLowerCase() === filterStatus);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-white font-sans overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed md:relative inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-80 md:w-72 lg:w-80 bg-slate-900/95 md:bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col z-40`}>
        <div className="p-6 md:p-8 border-b border-white/5">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl blur-lg opacity-50"></div>
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-xl">
                <Rocket className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
                Automation Hub
              </h1>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Playwright Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-5 space-y-2">
          <NavItem icon={<Monitor size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<BarChart2 size={20} />} label="Statistics" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
          <NavItem icon={<Clock size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem icon={<FileText size={20} />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-3 md:mb-4">
              <div className={`relative w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                {isRunning && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full bg-emerald-500"></div>
                  </>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{isRunning ? 'Running' : 'Idle'}</p>
                <p className="text-xs text-gray-500">{isRunning ? 'Tests in progress' : 'Ready to execute'}</p>
              </div>
            </div>
            {isRunning && (
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 animate-shimmer"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 flex flex-col overflow-hidden z-10">
        {activeTab === 'dashboard' && (
          <DashboardView
            selectedRegions={selectedRegions}
            selectedScripts={selectedScripts}
            toggleRegion={toggleRegion}
            toggleScript={toggleScript}
            selectAllScripts={selectAllScripts}
            clearAllScripts={clearAllScripts}
            handleRun={handleRun}
            handleStop={handleStop}
            isRunning={isRunning}
            logs={logs}
            logsEndRef={logsEndRef}
            stats={stats}
          />
        )}

        {activeTab === 'stats' && (
          <StatisticsView
            run={currentViewingRun}
            latestRun={latestRun}
            onBackToLatest={() => setCurrentViewingRun(latestRun)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            history={filteredHistory}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            onViewStatistics={viewRunStatistics}
            onRerun={handleRerun}
          />
        )}

        {activeTab === 'reports' && (
          <div className="flex-1 w-full h-full bg-white">
            <iframe
              key={reportKey}
              src={`/report/index.html?t=${reportKey}`}
              className="w-full h-full border-none"
              title="Playwright Report"
            ></iframe>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardView({
  selectedRegions, selectedScripts, toggleRegion, toggleScript,
  selectAllScripts, clearAllScripts, handleRun, handleStop, isRunning, logs, logsEndRef, stats
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 flex-1 overflow-hidden">
        {/* Configuration Panel */}
        <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6 overflow-y-auto lg:overflow-hidden">
          {/* Region Selector */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/5">
            <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
              <Server size={20} className="text-cyan-400" />
              Select Regions
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {REGIONS.map(region => (
                <button
                  key={region}
                  onClick={() => toggleRegion(region)}
                  className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${selectedRegions.includes(region)
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 border border-white/5'
                    }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          {/* Script Selector */}
          <div className="flex-1 bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Code2 size={20} className="text-teal-400" />
                Select Scripts ({selectedScripts.length}/{ALL_SCRIPTS.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllScripts}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-all"
                >
                  Select All
                </button>
                <button
                  onClick={clearAllScripts}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {ALL_SCRIPTS.map(script => (
                <button
                  key={script}
                  onClick={() => toggleScript(script)}
                  className={`w-full px-4 py-3 rounded-xl text-left font-medium text-sm transition-all flex items-center justify-between ${selectedScripts.includes(script)
                    ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 text-white'
                    : 'bg-slate-800/30 text-gray-400 hover:bg-slate-700/50 border border-white/5'
                    }`}
                >
                  <span>{SCRIPT_LABELS[script]}</span>
                  {selectedScripts.includes(script) && (
                    <CheckCircle size={16} className="text-cyan-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-xl relative overflow-hidden group ${isRunning
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:shadow-2xl hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            {!isRunning && (
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            )}
            {isRunning ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Executing Tests...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" fill="currentColor" />
                Run Automation
              </>
            )}
          </button>

          {/* Stop Button */}
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-lg ${!isRunning
              ? 'bg-gray-700 cursor-not-allowed text-gray-400'
              : 'bg-red-600 hover:bg-red-700 hover:shadow-xl active:scale-[0.98] text-white'
              }`}
          >
            <X className="w-5 h-5" />
            Stop Execution
          </button>
        </div>

        {/* Logs Panel */}
        <div className="lg:col-span-7 bg-slate-900/50 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/5 overflow-hidden flex flex-col min-h-[400px] lg:min-h-0">
          <div className="bg-slate-800/50 px-6 py-4 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Activity size={18} className="text-emerald-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">Console Output</span>
                <p className="text-xs text-gray-500">Real-time execution logs</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-slate-950/50 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Activity size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No logs yet. Run a test to see output.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className={`${log.type === 'stderr' ? 'text-red-400' : 'text-gray-300'}`}>
                    <span className="text-gray-600 mr-2">[{log.timestamp.toLocaleTimeString()}]</span>
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
  );
}

function StatisticsView({ run, latestRun, onBackToLatest }) {
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

function HistoryView({ history, filterStatus, setFilterStatus, onViewStatistics, onRerun }) {
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
            className="bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2 text-white font-medium"
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
              {history.map((run, idx) => (
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
                  <td className="p-5 text-gray-400 text-sm">{run.scripts.join(', ')}</td>
                  <td className="p-5 text-gray-300 text-sm font-mono font-bold">{(run.duration / 1000).toFixed(1)}s</td>
                  <td className="p-5 flex gap-2">
                    <button
                      onClick={() => onViewStatistics(run.runId)}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-bold hover:bg-cyan-500/30 transition-colors"
                    >
                      View Statistics
                    </button>
                    <button
                      onClick={() => onRerun(run.runId)}
                      className="px-3 py-1.5 bg-teal-500/20 text-teal-400 rounded-lg text-sm font-bold hover:bg-teal-500/30 transition-colors"
                    >
                      Rerun
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

// Helper Components
function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-4 rounded-xl transition-all font-semibold group ${active
        ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20'
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
    >
      <div className={`transition-transform ${active ? '' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

function StatsChip({ label, value, color }) {
  const colors = {
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    teal: 'bg-teal-500/20 text-teal-400 border-teal-500/30'
  };

  return (
    <div className={`px-4 py-2 rounded-xl border ${colors[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function QuickStat({ icon, label, value, color }) {
  const colors = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
    teal: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400'
  };

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="relative bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} border flex items-center justify-center mb-4`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <p className="text-sm font-medium text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
    teal: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400'
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} border flex items-center justify-center mb-4`}>
        {React.cloneElement(icon, { size: 20 })}
      </div>
      <p className="text-sm font-medium text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default App;
