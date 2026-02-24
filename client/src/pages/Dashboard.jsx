import { useState, useEffect, useRef } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import api from '../services/api'
import { formatCurrency, formatMonth } from '../utils/formatters'
import { useTheme } from '../context/ThemeContext'

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
    const { theme } = useTheme()

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

    if (loading) return <div className="space-y-6">{[1, 2, 3].map(i => <div key={i} className="card-base h-32 loading-shimmer" />)}</div>

    const stats = [
        { label: 'Employees', value: data?.headcount || 0, icon: '👥', color: 'from-emerald-400 to-emerald-500', dialColor: 'border-emerald-500' },
        { label: 'Total Payroll', value: data?.latestPayroll?.total_gross || 0, icon: '💰', color: 'from-[#5e17eb] to-[#7c4dff]', dialColor: 'border-[#5e17eb]', isCurrency: true },
        { label: 'CPF Output', value: (data?.latestPayroll?.total_cpf_employee || 0) + (data?.latestPayroll?.total_cpf_employer || 0), icon: '🏦', color: 'from-orange-400 to-orange-500', dialColor: 'border-orange-500', isCurrency: true },
        { label: 'Leaves Pending', value: data?.pendingLeaves || 0, icon: '📝', color: 'from-blue-400 to-blue-500', dialColor: 'border-blue-500' },
    ]

    const history = data?.payrollHistory || []

    // Dynamic chart colors based on theme
    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    const axisColor = theme === 'dark' ? '#a3aed0' : '#8f9bba'

    const barData = {
        labels: history.map(r => formatMonth(r.period_year, r.period_month)),
        datasets: [
            { label: 'Gross Pay', data: history.map(r => r.total_gross), backgroundColor: '#5e17eb', borderRadius: 4 },
            { label: 'CPF (Employer)', data: history.map(r => r.total_cpf_employer), backgroundColor: '#10b981', borderRadius: 4 },
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
            backgroundColor: ['#5e17eb', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            borderColor: theme === 'dark' ? '#111c44' : '#ffffff',
            borderWidth: 2,
        }],
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: axisColor, font: { family: 'Inter', weight: '500' } } } },
        scales: {
            x: { ticks: { color: axisColor }, grid: { display: false } },
            y: { ticks: { color: axisColor, callback: v => `$${(v / 1000).toFixed(0)}k` }, grid: { color: gridColor, drawBorder: false } },
        },
    }

    return (
        <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="card-base p-6 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-1">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl text-white bg-gradient-to-br ${stat.color} shadow-sm`}>
                                    {stat.icon}
                                </div>
                                <p className="text-sm font-bold text-[var(--text-main)] mt-3">
                                    {stat.label}
                                </p>
                            </div>
                            <div className={`w-14 h-14 rounded-full border-[3px] ${stat.dialColor} border-r-transparent flex items-center justify-center rotate-45`}>
                                <div className="absolute inset-0 flex items-center justify-center -rotate-45">
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] transition-colors">
                                        {stat.value > 1000 ? (stat.value / 1000).toFixed(1) + 'k' : stat.value}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-[var(--text-main)]">
                            {stat.isCurrency && <span className="text-lg text-[var(--text-muted)] font-medium mr-1">S$</span>}
                            <AnimatedCounter value={stat.value} />
                        </h3>
                    </div>
                ))}
            </div>

            {/* Expiring Documents Alert */}
            {expiringDocs.length > 0 && (
                <div className="card-base p-6 border border-warning/30 bg-warning/5">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">⚠️</span>
                        <h3 className="text-lg font-bold text-warning">Expiring Documents Alert</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {expiringDocs.map((doc, i) => {
                            const days = Math.ceil((new Date(doc.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
                            return (
                                <div key={i} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-1 shadow-sm">
                                    <span className="font-bold text-[var(--text-main)]">{doc.full_name}</span>
                                    <span className="text-sm text-[var(--text-muted)]">{doc.document_type} ({doc.document_number})</span>
                                    <span className={`text-sm font-bold mt-1 ${days < 0 ? 'text-danger' : 'text-warning'}`}>
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
                <div className="lg:col-span-2 card-base p-6">
                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-6">Total Applications / Payroll Trend</h3>
                    <div className="h-64 md:h-80 w-full">
                        {history.length > 0 ? <Bar data={barData} options={chartOptions} /> : <p className="text-[var(--text-muted)] text-center pt-20">No payroll data yet. Process your first payroll run to see trends.</p>}
                    </div>
                </div>
                <div className="card-base p-6">
                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-6">Cost Breakdown Structure</h3>
                    <div className="h-64 md:h-80 w-full relative flex items-center justify-center">
                        {latest ? <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor, padding: 20, font: { size: 12, family: 'Inter', weight: '500' } } } }, cutout: '70%' }} /> : <p className="text-[var(--text-muted)] text-center pt-20">Process a payroll run to see breakdown.</p>}

                        {/* Inner Donut Text */}
                        {latest && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                <span className="text-3xl font-bold text-[var(--text-main)]">{((latest.total_net / latest.total_gross) * 100).toFixed(0)}%</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1">Net Pay</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Runs */}
            {history.length > 0 && (
                <div className="card-base p-6">
                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-6">Recent Payroll Runs</h3>
                    <div className="overflow-x-auto">
                        <table className="table-theme">
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
                                        <td className="font-bold text-[var(--text-main)]">{formatMonth(run.period_year, run.period_month)}</td>
                                        <td>{formatCurrency(run.total_gross)}</td>
                                        <td>{formatCurrency(run.total_cpf_employee)}</td>
                                        <td>{formatCurrency(run.total_cpf_employer)}</td>
                                        <td>{formatCurrency(run.total_sdl)}</td>
                                        <td className="font-bold text-[var(--brand-primary)]">{formatCurrency(run.total_net)}</td>
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
