import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Menu, X } from 'lucide-react';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Statistics from './components/Statistics';
import History from './components/History';
import Reports from './components/Reports';

const socket = io();

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRegions, setSelectedRegions] = useState(['ZA']);
  const [selectedScripts, setSelectedScripts] = useState([]);
  const [suiteType, setSuiteType] = useState('smoke'); // 'smoke' or 'regression'
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [latestRun, setLatestRun] = useState(null); // Latest execution run for Statistics
  const [currentViewingRun, setCurrentViewingRun] = useState(null); // Specific run being viewed
  const [reportKey, setReportKey] = useState(Date.now()); // Force iframe refresh
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu state
  const [scriptsList, setScriptsList] = useState([]);
  const logsEndRef = useRef(null);

  // Fetch scripts when configuration changes
  useEffect(() => {
    fetchScripts();
  }, [suiteType, selectedRegions]);

  const fetchScripts = () => {
    // Fetch available scripts based on region and suite type
    const region = selectedRegions[0] || 'ZA';
    axios.get(`/api/metadata?region=${region}&suiteType=${suiteType}`)
      .then(res => {
        setScriptsList(res.data.scripts);
        // Clear selection when suite checks
        setSelectedScripts([]);
      })
      .catch(err => console.error("Failed to fetch scripts:", err));
  };

  // Initial setup and socket listeners
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
    setSelectedScripts(scriptsList);
  };

  const clearAllScripts = () => {
    setSelectedScripts([]);
  };

  const handleRun = () => {
    if (selectedRegions.length === 0) return alert("Select at least one region");
    if (selectedScripts.length === 0) return alert("Select at least one script");

    axios.post('/api/execute', {
      region: selectedRegions[0], // For now, run first region
      scripts: selectedScripts,
      suiteType // Pass selected suite type
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

      {/* Sidebar Component */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        isRunning={isRunning}
      />

      {/* Main Content */}
      <div className="relative flex-1 flex flex-col overflow-hidden z-10">
        {activeTab === 'dashboard' && (
          <Dashboard
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
            suiteType={suiteType}
            setSuiteType={setSuiteType}
            scriptsList={scriptsList}
          />
        )}

        {activeTab === 'stats' && (
          <Statistics
            run={currentViewingRun}
            latestRun={latestRun}
            onBackToLatest={() => setCurrentViewingRun(latestRun)}
          />
        )}

        {activeTab === 'history' && (
          <History
            history={filteredHistory}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            onViewStatistics={viewRunStatistics}
            onRerun={handleRerun}
          />
        )}

        {activeTab === 'reports' && (
          <Reports reportKey={reportKey} />
        )}
      </div>
    </div>
  );
}

export default App;
