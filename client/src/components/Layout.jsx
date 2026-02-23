import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    { to: '/employees', icon: '👥', label: 'Employees' },
    { to: '/leave', icon: '🌴', label: 'Leave' },
    { to: '/attendance', icon: '📅', label: 'Attendance' },
    { to: '/payroll', icon: '💰', label: 'Payroll' },
    { to: '/reports', icon: '📋', label: 'Reports' },
]

export default function Layout() {
    const { user, logout, entities, activeEntity, switchEntity, role } = useAuth()
    const [showMaster, setShowMaster] = useState(true)
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="glass-sidebar w-64 flex flex-col pt-6 shrink-0 border-r border-white/5">
                {/* Logo */}
                <div className="px-6 mb-6">
                    <h1 className="text-xl font-bold gradient-text">HRMS Singapore</h1>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">Workspace</p>
                </div>

                {/* Navigation - Scrollable */}
                <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
                    <div className="space-y-1">
                        {navItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                        ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`
                                }
                            >
                                <span className="text-lg">{item.icon}</span>
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>

                    {/* Master Data Group */}
                    {['Admin', 'HR'].includes(role) && (
                        <div className="pt-4 mt-4 border-t border-white/5">
                            <button
                                onClick={() => setShowMaster(!showMaster)}
                                className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors group"
                            >
                                <span>Master Data</span>
                                <span className={`transition-transform duration-200 ${showMaster ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {showMaster && (
                                <div className="mt-2 space-y-1 animate-slide-down">
                                    {role === 'Admin' && (
                                        <NavLink
                                            to="/entities"
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`
                                            }
                                        >
                                            <span className="text-base text-center w-5">🏢</span>
                                            <span>Entities</span>
                                        </NavLink>
                                    )}

                                    <NavLink
                                        to="/customers"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">🤝</span>
                                        <span>Customers</span>
                                    </NavLink>

                                    <NavLink
                                        to="/sites"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">📍</span>
                                        <span>Physical Sites</span>
                                    </NavLink>

                                    <NavLink
                                        to="/departments"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">📁</span>
                                        <span>Departments</span>
                                    </NavLink>

                                    <NavLink
                                        to="/employee-groups"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">🧩</span>
                                        <span>Groups</span>
                                    </NavLink>

                                    <NavLink
                                        to="/employee-grades"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">⭐</span>
                                        <span>Grades</span>
                                    </NavLink>

                                    <NavLink
                                        to="/leave-policies"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">📜</span>
                                        <span>Leave Policies</span>
                                    </NavLink>

                                    <NavLink
                                        to="/holidays"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">🎉</span>
                                        <span>Holidays</span>
                                    </NavLink>

                                    <NavLink
                                        to="/user-roles"
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        <span className="text-base text-center w-5">🔑</span>
                                        <span>User Roles</span>
                                    </NavLink>
                                </div>
                            )}
                        </div>
                    )}

                    {role === 'Admin' && (
                        <div className="pt-2">
                            <NavLink
                                to="/users"
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                        ? 'bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 text-purple-400 border border-purple-500/20'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`
                                }
                            >
                                <span className="text-lg">🔐</span>
                                <span>Access Control</span>
                            </NavLink>
                        </div>
                    )}
                </nav>

                {/* Bottom Section - Fixed at the bottom */}
                <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md space-y-4">
                    {/* Entity Switcher */}
                    {entities?.length > 0 && (
                        <div className="px-1">
                            <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-widest pl-1">Business Entity</p>
                            <div className="relative group">
                                <select
                                    className="w-full bg-slate-900 border border-white/10 text-white text-xs rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 p-2 appearance-none cursor-pointer hover:bg-slate-800 transition-all outline-none font-medium"
                                    value={activeEntity?.id || ''}
                                    onChange={(e) => {
                                        const selected = entities.find(ent => ent.id === parseInt(e.target.value));
                                        if (selected) switchEntity(selected);
                                    }}
                                >
                                    {entities.map(ent => (
                                        <option key={ent.id} value={ent.id} className="bg-slate-900 text-white py-2">
                                            {ent.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">
                                    ▼
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User Profile & Sign Out Wrapper */}
                    <div className="glass-card bg-white/[0.03] p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3 p-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-cyan-500/20 shrink-0">
                                {user?.fullName?.charAt(0) || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-200 truncate">{user?.fullName || 'Admin'}</p>
                                <p className="text-[10px] text-slate-500 truncate">{user?.username || 'admin'}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full mt-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-all duration-200 text-left flex items-center gap-2 group"
                        >
                            <svg className="w-3.5 h-3.5 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="font-medium">Sign Out</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
