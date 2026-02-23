import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatMonth } from '../utils/formatters'

export default function Reports() {
    const [tab, setTab] = useState('cpf')
    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)

    const tabs = [
        { key: 'cpf', label: '🏦 CPF Submission', desc: 'Monthly CPF contribution report' },
        { key: 'ir8a', label: '📊 IR8A Summary', desc: 'Annual IRAS tax report' },
        { key: 'sdl', label: '🎓 SDL Report', desc: 'Skills Development Levy' },
        { key: 'shg', label: '🤝 SHG Report', desc: 'Self-Help Group deductions' },
    ]

    const fetchReport = async () => {
        setLoading(true)
        try {
            let result
            switch (tab) {
                case 'cpf': result = await api.getCPFReport(year, month); break
                case 'ir8a': result = await api.getIR8AReport(year); break
                case 'sdl': result = await api.getSDLReport(year, month); break
                case 'shg': result = await api.getSHGReport(year, month); break
            }
            setData(result)
        } catch (err) {
            toast.error(err.message)
            setData(null)
        }
        setLoading(false)
    }

    useEffect(() => { setData(null) }, [tab])

    const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i).toLocaleString('en-SG', { month: 'long' }) }))

    const handleExportPDF = async () => {
        try {
            const { jsPDF } = await import('jspdf')
            const { default: autoTable } = await import('jspdf-autotable')

            const doc = new jsPDF()
            doc.setFontSize(16)
            doc.setTextColor(6, 182, 212)
            doc.text(tabs.find(t => t.key === tab).label.replace(/[^\w\s]/g, '').trim(), 105, 20, { align: 'center' })

            doc.setFontSize(10)
            doc.setTextColor(100)
            doc.text(tab === 'ir8a' ? `Year: ${year}` : `Period: ${formatMonth(year, month)}`, 105, 28, { align: 'center' })

            let tableData = []
            let headers = []

            if (tab === 'cpf' && data?.employees) {
                headers = [['Employee', 'ID', 'Gross Pay', 'CPF (EE)', 'CPF (ER)', 'OA', 'SA', 'MA']]
                tableData = data.employees.map(e => [e.employee_name, e.employee_code, formatCurrency(e.gross_pay), formatCurrency(e.cpf_employee), formatCurrency(e.cpf_employer), formatCurrency(e.cpf_oa), formatCurrency(e.cpf_sa), formatCurrency(e.cpf_ma)])
            } else if (tab === 'ir8a' && data?.employees) {
                headers = [['Employee', 'ID', 'Total Gross', 'CPF (EE)', 'CPF (ER)', 'Bonus']]
                tableData = data.employees.map(e => [e.employee_name, e.employee_code, formatCurrency(e.total_gross), formatCurrency(e.total_cpf_employee), formatCurrency(e.total_cpf_employer), formatCurrency(e.total_bonus)])
            } else if (tab === 'sdl' && data?.employees) {
                headers = [['Employee', 'ID', 'Gross Pay', 'SDL']]
                tableData = data.employees.map(e => [e.employee_name, e.employee_code, formatCurrency(e.gross_pay), formatCurrency(e.sdl)])
            } else if (tab === 'shg' && data?.employees) {
                headers = [['Employee', 'ID', 'Fund', 'Deduction']]
                tableData = data.employees.map(e => [e.employee_name, e.employee_code, e.shg_fund, formatCurrency(e.shg_deduction)])
            }

            if (tableData.length) {
                autoTable(doc, { startY: 35, head: headers, body: tableData, theme: 'grid', headStyles: { fillColor: [6, 182, 212] }, styles: { fontSize: 8 } })
            }

            doc.save(`${tab}_report_${year}_${month}.pdf`)
            toast.success('PDF downloaded')
        } catch (err) {
            toast.error('Export failed')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Compliance Reports</h1>
                <p className="text-slate-400 mt-1">CPF, IRAS, SDL & SHG statutory reports</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div className="glass-card p-6">
                <div className="flex items-end gap-4">
                    {tab !== 'ir8a' && (
                        <div>
                            <label className="block text-sm text-slate-300 mb-1.5">Month</label>
                            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select-glass w-40">
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Year</label>
                        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="select-glass w-32">
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button onClick={fetchReport} disabled={loading} className="gradient-btn">
                        {loading ? 'Loading...' : '📊 Generate Report'}
                    </button>
                    {data && (
                        <button onClick={handleExportPDF} className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm transition-all">
                            📥 Export PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Report Content */}
            {loading && <div className="glass-card h-48 loading-shimmer" />}

            {data && !loading && (
                <div className="glass-card p-6 animate-slide-up">
                    {/* CPF Report */}
                    {tab === 'cpf' && (
                        <>
                            <h3 className="text-lg font-semibold text-white mb-1">CPF Monthly Submission Report</h3>
                            <p className="text-sm text-slate-400 mb-4">{data.period}</p>
                            {data.totals && (
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="p-3 rounded-xl bg-white/3">
                                        <p className="text-xs text-slate-400">Total CPF (Employee)</p>
                                        <p className="text-lg font-bold text-white">{formatCurrency(data.totals.totalCPFEmployee)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/3">
                                        <p className="text-xs text-slate-400">Total CPF (Employer)</p>
                                        <p className="text-lg font-bold text-white">{formatCurrency(data.totals.totalCPFEmployer)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/3">
                                        <p className="text-xs text-slate-400">Total Contributions</p>
                                        <p className="text-lg font-bold text-cyan-400">{formatCurrency(data.totals.totalCPFEmployee + data.totals.totalCPFEmployer)}</p>
                                    </div>
                                </div>
                            )}
                            <table className="table-glass">
                                <thead><tr><th>Employee</th><th>ID</th><th>Gross</th><th>CPF (EE)</th><th>CPF (ER)</th><th>OA</th><th>SA</th><th>MA</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-white">{e.employee_name}</td><td>{e.employee_code}</td><td>{formatCurrency(e.gross_pay)}</td><td>{formatCurrency(e.cpf_employee)}</td><td>{formatCurrency(e.cpf_employer)}</td><td>{formatCurrency(e.cpf_oa)}</td><td>{formatCurrency(e.cpf_sa)}</td><td>{formatCurrency(e.cpf_ma)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* IR8A Report */}
                    {tab === 'ir8a' && (
                        <>
                            <h3 className="text-lg font-semibold text-white mb-1">IRAS IR8A Annual Summary</h3>
                            <p className="text-sm text-slate-400 mb-4">Year: {data.year}</p>
                            <table className="table-glass">
                                <thead><tr><th>Employee</th><th>ID</th><th>Total Gross</th><th>Total CPF (EE)</th><th>Total CPF (ER)</th><th>Total Bonus</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-white">{e.employee_name}</td><td>{e.employee_code}</td><td>{formatCurrency(e.total_gross)}</td><td>{formatCurrency(e.total_cpf_employee)}</td><td>{formatCurrency(e.total_cpf_employer)}</td><td>{formatCurrency(e.total_bonus)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* SDL Report */}
                    {tab === 'sdl' && (
                        <>
                            <h3 className="text-lg font-semibold text-white mb-1">Skills Development Levy Report</h3>
                            <p className="text-sm text-slate-400 mb-2">{data.period}</p>
                            <p className="text-sm text-cyan-400 mb-4">Total SDL: <span className="font-bold">{formatCurrency(data.totalSDL)}</span> (rounded down to nearest dollar)</p>
                            <table className="table-glass">
                                <thead><tr><th>Employee</th><th>ID</th><th>Gross Pay</th><th>SDL</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-white">{e.employee_name}</td><td>{e.employee_code}</td><td>{formatCurrency(e.gross_pay)}</td><td>{formatCurrency(e.sdl)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* SHG Report */}
                    {tab === 'shg' && (
                        <>
                            <h3 className="text-lg font-semibold text-white mb-1">Self-Help Group Deductions Report</h3>
                            <p className="text-sm text-slate-400 mb-4">{data.period}</p>
                            {data.byFund && (
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    {Object.entries(data.byFund).map(([fund, info]) => (
                                        <div key={fund} className="p-3 rounded-xl bg-white/3">
                                            <p className="text-xs text-slate-400">{fund}</p>
                                            <p className="text-lg font-bold text-white">{formatCurrency(info.total)}</p>
                                            <p className="text-xs text-slate-500">{info.count} employee(s)</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <table className="table-glass">
                                <thead><tr><th>Employee</th><th>ID</th><th>Fund</th><th>Deduction</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-white">{e.employee_name}</td><td>{e.employee_code}</td><td><span className="badge-info">{e.shg_fund}</span></td><td>{formatCurrency(e.shg_deduction)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {(!data.employees || data.employees.length === 0) && (
                        <p className="text-center py-8 text-slate-500">No data found for this period. Process a payroll run first.</p>
                    )}
                </div>
            )}
        </div>
    )
}
