import React from 'react';
import { Monitor, BarChart2, Clock, FileText, Rocket, Power } from 'lucide-react';

const NavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm group ${active
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
    >
        <div className={`p-1.5 rounded-lg transition-all ${active ? 'bg-cyan-500/20 text-cyan-400' : 'bg-transparent text-gray-500 group-hover:text-gray-300'
            }`}>
            {icon}
        </div>
        {label}
    </button>
);

export default function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, isRunning }) {
    return (
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
    );
}
