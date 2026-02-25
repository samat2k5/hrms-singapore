import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Swal from 'sweetalert2'

const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    { to: '/employees', icon: '👥', label: 'Employee' },
    { to: '/leave', icon: '🌴', label: 'Leaves' },
    { to: '/attendance', icon: '📅', label: 'Attendance' },
    { to: '/attendance/face', icon: '👤', label: 'Face Attendance' },
    { to: '/payroll', icon: '💰', label: 'Payroll' },
    { to: '/reports', icon: '📋', label: 'Reports' },
]

const masterItems = [
    { to: '/entities', icon: '🏢', label: 'Companies', adminOnly: true },
    { to: '/sites', icon: '📍', label: 'Sites', adminOnly: false },
    { to: '/customers', icon: '🤝', label: 'Customers', adminOnly: false },
    { to: '/departments', icon: '📁', label: 'Departments', adminOnly: false },
    { to: '/employee-groups', icon: '👥', label: 'Groups', adminOnly: false },
    { to: '/employee-grades', icon: '⭐', label: 'Grades', adminOnly: false },
    { to: '/shift-settings', icon: '🕒', label: 'Shift Configs', adminOnly: false },
    { to: '/holidays', icon: '🏖️', label: 'Holidays', adminOnly: false },
    { to: '/leave-policies', icon: '📜', label: 'Leave Policies', adminOnly: true },
    { to: '/users', icon: '👤', label: 'Users', adminOnly: true },
    { to: '/user-roles', icon: '🔑', label: 'Roles', adminOnly: true },
]

export default function Layout() {
    const { user, logout, entities, activeEntity, switchEntity, role } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const [showMaster, setShowMaster] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    const confirmLogout = async () => {
        const result = await Swal.fire({
            title: 'Sign Out?',
            text: 'Are you sure you want to log out of ezyHR?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: 'var(--brand-primary)',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, Sign Out',
            cancelButtonText: 'Stay Logged In',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (result.isConfirmed) {
            logout();
            navigate('/login');
        }
    }

    const closeMobileMenu = () => setMobileMenuOpen(false)

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path.startsWith('/employees')) return 'Employees';
        if (path.startsWith('/leave')) return 'Leave Management';
        if (path.startsWith('/payroll')) return 'Payroll';
        if (path.startsWith('/attendance')) return 'Attendance';
        const pathName = path.split('/')[1];
        if (pathName) {
            return pathName.charAt(0).toUpperCase() + pathName.slice(1).replace('-', ' ');
        }
        return 'Dashboard';
    }

    const pageTitle = getPageTitle();

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] font-sans">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border-main)] bg-[var(--bg-card)] shrink-0 absolute top-0 left-0 right-0 z-40">
                <div className="flex items-center gap-2">
                    <img src="/ezyhr-logo.png" alt="ezyHR Logo" className="h-16 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👥</text></svg>" }} />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleTheme} className="p-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors rounded-xl bg-[var(--bg-input)] shadow-sm border border-[var(--border-main)] mr-1">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-input)] rounded-xl transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                        </svg>
                    </button>
                </div>
            </div>

            {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={closeMobileMenu} />}

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-50
                w-64 flex flex-col shrink-0 border-r border-[var(--border-main)] sidebar-theme
                transform transition-transform duration-300 ease-in-out
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Logo Area */}
                <div className="h-32 flex flex-col items-center justify-center px-4 border-b border-[var(--border-main)] md:border-none md:mt-4">
                    <img src="/ezyhr-logo.png" alt="ezyHR Logo" className="h-24 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👥</text></svg>" }} />
                    <span className="text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-cyan-400 via-emerald-400 to-blue-500 bg-clip-text text-transparent text-center px-2">
                        MOM · CPF · IRAS · Compliant HRMS
                    </span>
                </div>

                {/* Main Menu nav */}
                <div className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-2">
                    Main Menu
                </div>
                <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
                    <div className="space-y-1">
                        {navItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                onClick={closeMobileMenu}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive
                                        ? 'bg-[var(--bg-main)] brand-text shadow-sm'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)]'
                                    }`
                                }
                            >
                                <span className="text-lg w-6 text-center">{item.icon}</span>
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>

                    {/* Master Data Group */}
                    {['Admin', 'HR', 'Operations Admin'].includes(role) && (
                        <div className="pt-4 mt-4">
                            <div className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                Settings
                            </div>
                            <button
                                onClick={() => setShowMaster(!showMaster)}
                                className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg w-6 text-center">⚙️</span>
                                    <span>Master Data</span>
                                </div>
                                <span className={`transition-transform duration-200 ${showMaster ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {showMaster && (
                                <div className="mt-1 space-y-1 ml-4 border-l-2 border-[var(--border-main)] pl-2">
                                    {masterItems.map(item => {
                                        if (item.adminOnly && role !== 'Admin') return null;
                                        return (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                onClick={closeMobileMenu}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                        ? 'brand-text bg-[var(--bg-main)] shadow-sm'
                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)]'
                                                    }`
                                                }
                                            >
                                                <span className="text-base w-5 text-center">{item.icon}</span>
                                                <span>{item.label}</span>
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="p-4 border-t border-[var(--border-main)] sidebar-theme mt-auto">
                    {/* Entity Switcher */}
                    {entities?.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[10px] text-[var(--text-muted)] mb-1 font-bold uppercase tracking-widest pl-1">Entity</p>
                            <div className="relative group">
                                <select
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] text-xs rounded-xl focus:ring-1 focus:ring-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)] p-2.5 appearance-none cursor-pointer font-medium"
                                    value={activeEntity?.id || ''}
                                    onChange={(e) => {
                                        const selected = entities.find(ent => ent.id === parseInt(e.target.value));
                                        if (selected) switchEntity(selected);
                                    }}
                                >
                                    {entities.map(ent => (
                                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] text-[8px]">▼</div>
                            </div>
                        </div>
                    )}

                    {/* User Profile & Logout */}
                    <div className="flex items-center justify-between p-2 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-main)]">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex shrink-0 items-center justify-center text-white text-xs font-bold shadow-sm">
                                {user?.fullName?.charAt(0) || 'A'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-bold text-[var(--text-main)] truncate leading-tight">
                                    {user?.fullName || 'User'}
                                </span>
                                <span className="text-[9px] font-medium text-[var(--text-muted)] truncate capitalize">
                                    {role?.toLowerCase()}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={confirmLogout}
                            className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Sign Out"
                        >
                            <span className="text-sm">🚪</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[var(--bg-main)] pt-16 md:pt-0">
                {/* Topbar */}
                <header className="hidden md:flex h-20 px-8 items-center justify-between shrink-0 bg-[var(--bg-main)]">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-[var(--text-muted)] mb-0.5">Home / <span className="text-[var(--text-main)] font-semibold">{pageTitle}</span></span>
                        <h2 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">{pageTitle === 'Dashboard' ? 'Admin Dashboard' : pageTitle}</h2>
                    </div>

                    <div className="flex items-center gap-3 bg-[var(--bg-card)] px-3 py-2 rounded-full shadow-[var(--shadow-main)] border border-[var(--border-main)]">

                        <button onClick={toggleTheme} className="p-2.5 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors rounded-full hover:bg-[var(--bg-input)]" title="Toggle Dark/Light Mode">
                            {theme === 'light' ? '🌙' : '☀️'}
                        </button>

                        <div className="pl-4 py-1 ml-1 border-l border-[var(--border-main)] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--brand-primary)] flex justify-center items-center text-white font-bold text-base shadow-sm">
                                {user?.fullName?.charAt(0) || 'A'}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:px-8 w-full custom-scrollbar">
                    <div className="max-w-7xl mx-auto pb-12 animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
