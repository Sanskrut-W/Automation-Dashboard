import React from 'react';
import { Monitor, BarChart2, Clock, FileText, Rocket, Layers } from 'lucide-react';

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm group ${active
            ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
    >
        <div className={`p-1.5 rounded-lg transition-all ${active
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'bg-transparent text-gray-500 group-hover:text-gray-300'
            }`}>
            {icon}
        </div>
        {label}
    </button>
);

const PROJECT_COLORS = {
    synapse: {
        active: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
        dot: 'bg-cyan-500',
        badge: 'from-cyan-500 to-teal-500',
    },
    jpc: {
        active: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
        dot: 'bg-purple-500',
        badge: 'from-purple-500 to-pink-500',
    },
    purevantage: {
        active: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
        dot: 'bg-emerald-500',
        badge: 'from-emerald-500 to-green-500',
    },
};

export default function Sidebar({
    activeTab, setActiveTab, isMobileMenuOpen, isRunning,
    availableProjects, selectedProject, onSwitchProject
}) {
    const colors = PROJECT_COLORS[selectedProject?.id] || PROJECT_COLORS.synapse;

    return (
        <div className={`fixed md:relative inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-80 md:w-72 lg:w-80 bg-slate-900/95 md:bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col z-40`}>

            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/5">
                <div className="flex items-center gap-4 mb-3">
                    <div className="relative">
                        <div className={`absolute inset-0 bg-gradient-to-br ${colors.badge} rounded-2xl blur-lg opacity-50`}></div>
                        <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.badge} flex items-center justify-center shadow-xl`}>
                            <Rocket className="w-7 h-7 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold bg-gradient-to-r ${colors.badge} bg-clip-text text-transparent`}>
                            Automation Hub
                        </h1>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">Multi-Project Dashboard</p>
                    </div>
                </div>
            </div>

            {/* Project Switcher */}
            <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-3">
                    <Layers size={12} className="text-gray-500" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project</span>
                </div>
                <div className="space-y-1.5">
                    {(availableProjects.length > 0 ? availableProjects : [
                        { id: 'synapse', name: 'Synapse (Betway)', type: 'regional' },
                        { id: 'jpc', name: 'JPC', type: 'regional' },
                        { id: 'purevantage', name: 'Pure Vantage', type: 'flat' },
                    ]).map(project => {
                        const c = PROJECT_COLORS[project.id] || PROJECT_COLORS.synapse;
                        const isActive = selectedProject?.id === project.id;
                        return (
                            <button
                                key={project.id}
                                onClick={() => onSwitchProject(project)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-semibold ${isActive
                                    ? c.active
                                    : 'border-white/5 text-gray-400 hover:bg-white/5 hover:text-white hover:border-white/10'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${isActive ? c.dot : 'bg-gray-600'}`}></div>
                                {project.name}
                                {isActive && (
                                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${c.badge} text-white font-bold`}>
                                        Active
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-5 py-3 space-y-1.5 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Navigation</span>
                </div>
                <NavItem icon={<Monitor size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                <NavItem icon={<BarChart2 size={20} />} label="Statistics" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
                <NavItem icon={<Clock size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <NavItem icon={<FileText size={20} />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            </nav>

            {/* Status */}
            <div className="p-6 border-t border-white/5">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-3 mb-3">
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
                            <p className="text-xs text-gray-500">
                                {isRunning ? `${selectedProject?.name} tests in progress` : 'Ready to execute'}
                            </p>
                        </div>
                    </div>
                    {isRunning && (
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${colors.badge} animate-shimmer`}></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
