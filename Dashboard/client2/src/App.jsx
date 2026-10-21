import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Menu, X } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Statistics from './components/Statistics';
import History from './components/History';
import Reports from './components/Reports';

const socket = io();

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Project state
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState({
    id: 'synapse', name: 'Synapse (Betway)', type: 'regional',
    regions: ['ZA', 'GH', 'MW', 'MZ', 'BW', 'TZ', 'NG', 'ZM'],
    defaultRegion: 'ZA', suiteTypes: ['smoke', 'regression'],
    environments: null, defaultEnv: null
  });

  // Execution config state
  const [selectedRegions, setSelectedRegions] = useState(['ZA']);
  const [selectedEnv, setSelectedEnv] = useState('dev');
  const [selectedScripts, setSelectedScripts] = useState([]);
  const [suiteType, setSuiteType] = useState('smoke');
  const [scriptsList, setScriptsList] = useState([]);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);

  // Batch (multi-region) progress — regions run one after another
  const [batch, setBatch] = useState(null);

  // History / stats state
  const [history, setHistory] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [latestRun, setLatestRun] = useState(null);
  const [currentViewingRun, setCurrentViewingRun] = useState(null);
  const [reportKey, setReportKey] = useState(Date.now());

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const logsEndRef = useRef(null);

  // Load available projects on mount
  useEffect(() => {
    axios.get('/api/projects')
      .then(res => {
        setAvailableProjects(res.data);
        // The seeded default may not exist server-side — fall back to the first real one.
        if (res.data.length && !res.data.some(p => p.id === selectedProject.id)) {
          switchProject(res.data[0]);
        }
      })
      .catch(err => console.error('Failed to load projects:', err));
  }, []);

  // Fetch scripts whenever project, regions, or suiteType changes
  useEffect(() => {
    fetchScripts();
  }, [selectedProject, selectedRegions, selectedEnv, suiteType]);

  const fetchScripts = () => {
    const params = new URLSearchParams({ project: selectedProject.id });
    if (selectedProject.type === 'regional') {
      const regions = selectedRegions.length
        ? selectedRegions
        : [selectedProject.defaultRegion || 'ZA'];
      params.set('regions', regions.join(','));
      params.set('region', regions[0]);
      params.set('suiteType', suiteType);
    }
    axios.get(`/api/metadata?${params}`)
      .then(res => {
        const list = res.data.scripts || [];
        setScriptsList(list);
        // Keep what is still selectable instead of wiping the selection every time a
        // region is toggled on or off.
        setSelectedScripts(prev => prev.filter(s => list.includes(s)));
      })
      .catch(err => console.error('Failed to fetch scripts:', err));
  };

  // Switch project — reset all config state
  const switchProject = (project) => {
    setSelectedProject(project);
    setSelectedRegions([project.defaultRegion || 'ZA']);
    setSelectedEnv(project.defaultEnv || 'dev');
    setSelectedScripts([]);
    setSuiteType('smoke');
    setLogs([]);
    setBatch(null);
    setCurrentViewingRun(null);
    setLatestRun(null);
    fetchHistory(project.id);
    fetchLatestRun(project.id);
  };

  // Socket listeners + initial history/run fetch
  useEffect(() => {
    fetchHistory(selectedProject.id);
    fetchLatestRun(selectedProject.id);

    socket.on('batch:start', (data) => {
      setIsRunning(true);
      setLogs([]);
      setBatch({
        batchId: data.batchId,
        regions: data.regions || [],
        total: data.total || (data.regions || []).length,
        reportFolder: data.reportFolder,
        index: 0,
        phase: 'running',
        current: (data.regions || [])[0] || null,
        done: [],
        finished: false,
      });
    });

    socket.on('batch:progress', (data) => {
      setBatch(prev => {
        if (!prev || prev.batchId !== data.batchId) return prev;
        const done = data.phase === 'done'
          ? [...prev.done.filter(d => d.region !== data.region),
          { region: data.region, status: data.status, pdf: data.pdf }]
          : prev.done;
        return { ...prev, index: data.index, current: data.region, phase: data.phase, done };
      });
    });

    socket.on('batch:end', (data) => {
      setIsRunning(false);
      setBatch(prev => prev && prev.batchId !== data.batchId
        ? prev
        : {
          ...(prev || {}),
          batchId: data.batchId,
          reportFolder: data.reportFolder,
          phase: 'finished',
          finished: true,
          stopped: data.stopped,
          results: data.results || [],
        });
      fetchHistory(selectedProject.id);
      fetchLatestRun(selectedProject.id);
      setReportKey(Date.now());
    });

    socket.on('execution:start', (data) => {
      setIsRunning(true);
      setCurrentRunId(data.runId);
    });

    socket.on('execution:log', (data) => {
      setLogs(prev => [...prev, { type: data.type, data: data.data, timestamp: new Date() }]);
    });

    socket.on('execution:end', (data) => {
      fetchHistory(selectedProject.id);
      fetchLatestRun(selectedProject.id);
      if (data.results) setLatestRun(data.results);
      setReportKey(Date.now());
    });

    socket.on('execution:stopped', (data) => {
      setIsRunning(false);
      setLogs(prev => [...prev, { type: 'info', data: `\n⚠️ ${data.message}\n`, timestamp: new Date() }]);
    });

    return () => {
      socket.off('batch:start');
      socket.off('batch:progress');
      socket.off('batch:end');
      socket.off('execution:start');
      socket.off('execution:log');
      socket.off('execution:end');
      socket.off('execution:stopped');
    };
  }, [selectedProject.id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchHistory = (projectId) => {
    const id = projectId || selectedProject.id;
    axios.get(`/api/history?project=${id}`)
      .then(res => setHistory(res.data))
      .catch(err => console.error(err));
  };

  const fetchLatestRun = (projectId) => {
    const id = projectId || selectedProject.id;
    axios.get(`/api/runs/latest?project=${id}`)
      .then(res => {
        setLatestRun(res.data);
        if (!currentViewingRun) setCurrentViewingRun(res.data);
      })
      .catch(err => {
        if (err.response?.status !== 404) console.error('Error fetching latest run:', err);
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
    if (!confirm('Rerun this execution?')) return;
    axios.post(`/api/runs/${runId}/rerun`)
      .then(() => setActiveTab('dashboard'))
      .catch(err => alert('Failed to rerun: ' + err.message));
  };

  const handleStop = () => {
    axios.post('/api/stop').catch(err => {
      if (err.response?.status !== 400) console.error('Failed to stop:', err.message);
    });
  };

  const toggleRegion = (region) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const selectAllRegions = () => setSelectedRegions([...(selectedProject.regions || [])]);
  const clearAllRegions = () => setSelectedRegions([]);

  const toggleScript = (script) => {
    setSelectedScripts(prev =>
      prev.includes(script) ? prev.filter(s => s !== script) : [...prev, script]
    );
  };

  const selectAllScripts = () => setSelectedScripts([...scriptsList]);
  const clearAllScripts = () => setSelectedScripts([]);

  const handleRun = () => {
    if (selectedProject.type === 'regional' && selectedRegions.length === 0) {
      return alert('Select at least one region');
    }
    if (selectedScripts.length === 0) return alert('Select at least one script');

    const body = {
      project: selectedProject.id,
      scripts: selectedScripts,
      suiteType,
      env: {}
    };

    if (selectedProject.type === 'regional') {
      // Regions run sequentially, in the order they appear in the project config.
      const ordered = (selectedProject.regions || []).filter(r => selectedRegions.includes(r));
      body.regions = ordered.length ? ordered : selectedRegions;
      body.region = body.regions[0];
    } else {
      body.environment = selectedEnv;
    }

    axios.post('/api/execute', body)
      .then(res => console.log('Started', res.data))
      .catch(err => alert('Failed to start: ' + (err.response?.data?.error || err.message)));
  };

  const getStats = () => {
    const total = history.length;
    const passed = history.filter(h => h.status === 'Passed').length;
    const failed = history.filter(h => h.status === 'Failed').length;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgDuration = total > 0
      ? Math.round(history.reduce((acc, h) => acc + (h.duration || 0), 0) / total / 1000)
      : 0;
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

      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        isRunning={isRunning}
        availableProjects={availableProjects}
        selectedProject={selectedProject}
        onSwitchProject={switchProject}
      />

      <div className="relative flex-1 flex flex-col overflow-hidden z-10">
        {activeTab === 'dashboard' && (
          <Dashboard
            selectedProject={selectedProject}
            selectedRegions={selectedRegions}
            selectedEnv={selectedEnv}
            setSelectedEnv={setSelectedEnv}
            selectedScripts={selectedScripts}
            toggleRegion={toggleRegion}
            selectAllRegions={selectAllRegions}
            clearAllRegions={clearAllRegions}
            toggleScript={toggleScript}
            selectAllScripts={selectAllScripts}
            clearAllScripts={clearAllScripts}
            handleRun={handleRun}
            handleStop={handleStop}
            isRunning={isRunning}
            batch={batch}
            logs={logs}
            logsEndRef={logsEndRef}
            stats={stats}
            suiteType={suiteType}
            setSuiteType={setSuiteType}
            scriptsList={scriptsList}
          />
        )}

        {/* Statistics temporarily hidden — uncomment to restore */}
        {/* {activeTab === 'stats' && (
          <Statistics
            run={currentViewingRun}
            latestRun={latestRun}
            onBackToLatest={() => setCurrentViewingRun(latestRun)}
          />
        )} */}

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
          <Reports
            reportKey={reportKey}
            selectedProject={selectedProject}
            batch={batch}
          />
        )}
      </div>
    </div>
  );
}

export default App;
