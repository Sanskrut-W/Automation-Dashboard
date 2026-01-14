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
  const [config, setConfig] = useState(null); // Dynamic Config
  const [inputValues, setInputValues] = useState({}); // Stores user selections for generic inputs
  const [selectedScripts, setSelectedScripts] = useState([]);

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [latestRun, setLatestRun] = useState(null);
  const [currentViewingRun, setCurrentViewingRun] = useState(null);
  const [reportKey, setReportKey] = useState(Date.now());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scriptsList, setScriptsList] = useState([]);
  const logsEndRef = useRef(null);

  // 1. Fetch Configuration on Mount
  useEffect(() => {
    axios.get('/api/config')
      .then(res => {
        const cfg = res.data;
        setConfig(cfg);

        // Initialize defaults
        const initialValues = {};
        if (cfg.inputs) {
          cfg.inputs.forEach(input => {
            initialValues[input.id] = input.default || '';
            // If select, default to first option if no default provided
            if (!initialValues[input.id] && input.type === 'select' && input.options.length > 0) {
              const firstOpt = input.options[0];
              initialValues[input.id] = typeof firstOpt === 'string' ? firstOpt : firstOpt.value;
            }
          });
        }
        setInputValues(initialValues);
      })
      .catch(err => console.error("Failed to load config", err));
  }, []);

  // 2. Fetch Scripts when inputs change
  useEffect(() => {
    if (!config) return;
    fetchScripts();
  }, [inputValues, config]);

  const fetchScripts = () => {
    if (!config) return;

    // Convert inputValues object to query string
    const params = new URLSearchParams(inputValues).toString();

    axios.get(`/api/scripts?${params}`)
      .then(res => {
        setScriptsList(res.data.scripts);
        // Clear selection if scripts change? Maybe check overlap?
        // setSelectedScripts([]); 
      })
      .catch(err => console.error("Failed to fetch scripts:", err));
  };

  const handleInputChange = (inputId, value) => {
    setInputValues(prev => ({
      ...prev,
      [inputId]: value
    }));
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
      fetchLatestRun();
      if (data.results) {
        setLatestRun(data.results);
      }
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
        setActiveTab('dashboard');
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

  // Legacy toggle helpers removed in favor of handleInputChange for generic inputs
  // Script selection remains standard list
  const toggleScript = (script) => {
    setSelectedScripts(prev =>
      prev.includes(script)
        ? prev.filter(s => s !== script)
        : [...prev, script]
    );
  };

  const selectAllScripts = (list) => { // List passed or use scriptsList
    setSelectedScripts(list || scriptsList);
  };

  const clearAllScripts = () => {
    setSelectedScripts([]);
  };

  const handleRun = () => {
    // Validation?
    // if (!inputValues.region) return alert("Select a region"); 
    // Generic validation based on config? For now assume inputs are valid if they exist.
    if (selectedScripts.length === 0) return alert("Select at least one script");

    axios.post('/api/execute', {
      ...inputValues, // Spread all generic inputs (region, suite, etc)
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

  // Wait for config to load?
  if (!config) return <div className="text-white flex items-center justify-center h-screen">Loading Configuration...</div>;

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
            config={config}
            inputValues={inputValues}
            onInputChange={handleInputChange}
            selectedScripts={selectedScripts}
            toggleScript={toggleScript}
            selectAllScripts={selectAllScripts}
            clearAllScripts={clearAllScripts}
            handleRun={handleRun}
            handleStop={handleStop}
            isRunning={isRunning}
            logs={logs}
            logsEndRef={logsEndRef}
            stats={stats}
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
