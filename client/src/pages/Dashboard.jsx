import { useState, useEffect, useRef } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import api from '../services/api'
import { formatCurrency, formatMonth } from '../utils/formatters'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

function AnimatedCounter({ value, prefix = '', suffix = '' }) {
    const [display, setDisplay] = useState(0)
    const ref = useRef()
    useEffect(() => {
        const target = typeof value === 'number' ? value : parseFloat(value) || 0
        let start = 0
        const duration = 1000
        const startTime = Date.now()
        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplay(Math.floor(start + (target - start) * eased))
            if (progress < 1) ref.current = requestAnimationFrame(animate)
        }
        ref.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(ref.current)
    }, [value])
    return <span>{prefix}{display.toLocaleString()}{suffix}</span>
}

export default function Dashboard() {
    const [data, setData] = useState(null)
    const [expiringDocs, setExpiringDocs] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            api.getDashboard(),
            api.getExpiringDocuments()
        ])
            .then(([dashData, docs]) => {
                setData(dashData)
                setExpiringDocs(docs)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="space-y-6">{[1, 2, 3].map(i => <div key={i} className="glass-card h-32 loading-shimmer" />)}</div>

    const stats = [
        { label: 'Active Employees', value: data?.headcount || 0, icon: '👥', color: 'from-cyan-500 to-cyan-600' },
        { label: 'Total Payroll', value: data?.latestPayroll?.total_gross || 0, icon: '💰', color: 'from-emerald-500 to-emerald-600', isCurrency: true },
        { label: 'CPF Contributions', value: (data?.latestPayroll?.total_cpf_employee || 0) + (data?.latestPayroll?.total_cpf_employer || 0), icon: '🏦', color: 'from-blue-500 to-blue-600', isCurrency: true },
        { label: 'Pending Leaves', value: data?.pendingLeaves || 0, icon: '📝', color: 'from-amber-500 to-amber-600' },
    ]

    const history = data?.payrollHistory || []
    const barData = {
        labels: history.map(r => formatMonth(r.period_year, r.period_month)),
        datasets: [
            { label: 'Gross Pay', data: history.map(r => r.total_gross), backgroundColor: 'rgba(6, 182, 212, 0.6)', borderRadius: 8 },
            { label: 'CPF (Employer)', data: history.map(r => r.total_cpf_employer), backgroundColor: 'rgba(59, 130, 246, 0.6)', borderRadius: 8 },
        ],
    }

    const latest = data?.latestPayroll
    const doughnutData = {
        labels: ['Net Pay', 'CPF Employee', 'CPF Employer', 'SDL', 'SHG'],
        datasets: [{
            data: [
                latest?.total_net || 0,
                latest?.total_cpf_employee || 0,
                latest?.total_cpf_employer || 0,
                latest?.total_sdl || 0,
                latest?.total_shg || 0,
            ],
            backgroundColor: ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'],
            borderColor: 'transparent',
        }],
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
        scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.03)' } },
            y: { ticks: { color: '#64748b', callback: v => `$${(v / 1000).toFixed(0)}k` }, grid: { color: 'rgba(255,255,255,0.03)' } },
        },
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400 mt-1">Singapore Payroll Overview</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {stats.map((stat, i) => (
                    <div key={i} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{stat.icon}</span>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center opacity-80`}>
                                <span className="text-lg">↗</span>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {stat.isCurrency ? (
                                <><span className="text-lg text-slate-400">S$</span><AnimatedCounter value={stat.value} /></>
                            ) : (
                                <AnimatedCounter value={stat.value} />
                            )}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Expiring Documents Alert */}
            {expiringDocs.length > 0 && (
                <div className="glass-card p-6 border border-warning/30 bg-warning/5">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">⚠️</span>
                        <h3 className="text-lg font-semibold text-warning">Expiring Documents Alert</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {expiringDocs.map((doc, i) => {
                            const days = Math.ceil((new Date(doc.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
                            return (
                                <div key={i} className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col gap-1">
                                    <span className="font-medium text-white">{doc.full_name}</span>
                                    <span className="text-sm text-slate-400">{doc.document_type} ({doc.document_number})</span>
                                    <span className={`text-sm font-semibold ${days < 0 ? 'text-danger' : 'text-warning'}`}>
                                        {days < 0 ? `Expired ${Math.abs(days)} days ago` : `Expiring in ${days} days`}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Monthly Payroll Trend</h3>
                    <div className="h-72">
                        {history.length > 0 ? <Bar data={barData} options={chartOptions} /> : <p className="text-slate-500 text-center pt-20">No payroll data yet. Process your first payroll run to see trends.</p>}
                    </div>
                </div>
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
                    <div className="h-72">
                        {latest ? <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 11, family: 'Inter' } } } } }} /> : <p className="text-slate-500 text-center pt-20">Process a payroll run to see breakdown.</p>}
                    </div>
                </div>
            </div>

            {/* Recent Runs */}
            {history.length > 0 && (
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Payroll Runs</h3>
                    <div className="overflow-x-auto">
                        <table className="table-glass">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Total Gross</th>
                                    <th>CPF (Employee)</th>
                                    <th>CPF (Employer)</th>
                                    <th>SDL</th>
                                    <th>Net Pay</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.slice(-5).reverse().map(run => (
                                    <tr key={run.id}>
                                        <td className="font-medium text-white">{formatMonth(run.period_year, run.period_month)}</td>
                                        <td>{formatCurrency(run.total_gross)}</td>
                                        <td>{formatCurrency(run.total_cpf_employee)}</td>
                                        <td>{formatCurrency(run.total_cpf_employer)}</td>
                                        <td>{formatCurrency(run.total_sdl)}</td>
                                        <td className="font-medium text-cyan-400">{formatCurrency(run.total_net)}</td>
                                        <td><span className="badge-success">{run.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
