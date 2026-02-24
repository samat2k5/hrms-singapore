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
                case 'cpf': result = await api.getCPFReport(year, month); break;
                case 'sdl': result = await api.getSDLReport(year, month); break;
                case 'shg': result = await api.getSHGReport(year, month); break;
                case 'ir8a':
                    const summary = await api.getIR8AReport(year);
                    const forms = await api.getIRASForms(year).catch(() => []);
                    const logs = await api.getIRASLogs().catch(() => []);
                    const cessation = await api.getIRASCessation().catch(() => []);
                    const cpfExcess = await api.getIRASCpfExcess().catch(() => []);
                    result = { summary, forms, logs, cessation, cpfExcess, year };
                    break;
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
            } else if (tab === 'ir8a' && data?.summary?.employees) {
                headers = [['Employee', 'ID', 'Total Gross', 'CPF (EE)', 'CPF (ER)', 'Bonus']]
                tableData = data.summary.employees.map(e => [e.employee_name, e.employee_code, formatCurrency(e.total_gross), formatCurrency(e.total_cpf_employee), formatCurrency(e.total_cpf_employer), formatCurrency(e.total_bonus)])
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
                <h1 className="text-3xl font-bold text-[var(--text-main)]">Compliance Reports</h1>
                <p className="text-[var(--text-muted)] mt-1">CPF, IRAS, SDL & SHG statutory reports</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)] border border-transparent'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div className="card-base p-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    {tab !== 'ir8a' && (
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm text-[var(--text-muted)] mb-1.5">Month</label>
                            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select-base w-full sm:w-40">
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-[var(--text-muted)] mb-1.5">Year</label>
                        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="select-base w-full sm:w-32">
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button onClick={fetchReport} disabled={loading} className="btn-primary w-full sm:w-auto mt-2 sm:mt-0 text-center">
                        {loading ? 'Loading...' : '📊 Generate Report'}
                    </button>
                    {data && (
                        <button onClick={handleExportPDF} className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] text-sm transition-all text-center">
                            📥 Export PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Report Content */}
            {loading && <div className="card-base h-48 loading-shimmer" />}

            {data && !loading && (
                <div className="card-base p-6 animate-slide-up">
                    {/* CPF Report */}
                    {tab === 'cpf' && (
                        <>
                            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-1">CPF Monthly Submission Report</h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">{data.period}</p>
                            {data.totals && (
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="p-3 rounded-xl bg-[var(--bg-input)]">
                                        <p className="text-xs text-[var(--text-muted)]">Total CPF (Employee)</p>
                                        <p className="text-lg font-bold text-[var(--text-main)]">{formatCurrency(data.totals.totalCPFEmployee)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-[var(--bg-input)]">
                                        <p className="text-xs text-[var(--text-muted)]">Total CPF (Employer)</p>
                                        <p className="text-lg font-bold text-[var(--text-main)]">{formatCurrency(data.totals.totalCPFEmployer)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-[var(--bg-input)]">
                                        <p className="text-xs text-[var(--text-muted)]">Total Contributions</p>
                                        <p className="text-lg font-bold text-[var(--brand-primary)]">{formatCurrency(data.totals.totalCPFEmployee + data.totals.totalCPFEmployer)}</p>
                                    </div>
                                </div>
                            )}
                            <table className="table-theme">
                                <thead><tr><th>Employee</th><th>ID</th><th>Gross</th><th>CPF (EE)</th><th>CPF (ER)</th><th>OA</th><th>SA</th><th>MA</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-[var(--text-main)]">{e.employee_name}</td><td>{e.employee_code}</td><td>{formatCurrency(e.gross_pay)}</td><td>{formatCurrency(e.cpf_employee)}</td><td>{formatCurrency(e.cpf_employer)}</td><td>{formatCurrency(e.cpf_oa)}</td><td>{formatCurrency(e.cpf_sa)}</td><td>{formatCurrency(e.cpf_ma)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* IR8A / IRAS Compliance Dashboard */}
                    {tab === 'ir8a' && (
                        <div className="space-y-8 animate-fade-in transition-all">
                            {/* ALERTS */}
                            {data.cessation && data.cessation.length > 0 && (
                                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                                    <h4 className="flex items-center gap-2 text-amber-400 font-bold mb-2">⚠️ IR21 Required (Foreign Cessation)</h4>
                                    <p className="text-sm text-[var(--text-muted)] mb-3">The following foreign employees have a cessation date and require Form IR21 submission to withhold tax clearance. They have been automatically excluded from the standard IR8A generation batch.</p>
                                    <table className="table-theme w-full text-sm">
                                        <thead><tr><th>Employee</th><th>ID</th><th>Nationality</th><th>Cessation Date</th></tr></thead>
                                        <tbody>
                                            {data.cessation.map((e, i) => (
                                                <tr key={i}><td className="text-[var(--text-main)]">{e.full_name}</td><td>{e.employee_id}</td><td>{e.nationality}</td><td className="text-amber-400 font-medium">{e.cessation_date}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {data.cpfExcess && data.cpfExcess.length > 0 && (
                                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10">
                                    <h4 className="flex items-center gap-2 text-rose-400 font-bold mb-2">🚨 CPF Excess Contribution Detected</h4>
                                    <p className="text-sm text-[var(--text-muted)] mb-3">The following employees appear to have CPF contributions exceeding their Ordinary Wage/Additional Wage caps. You must claim a refund from the CPF Board.</p>
                                    <table className="table-theme w-full text-sm">
                                        <thead><tr><th>Employee</th><th>ID</th><th>Total CPF Paid</th></tr></thead>
                                        <tbody>
                                            {data.cpfExcess.map((e, i) => (
                                                <tr key={i}><td className="text-[var(--text-main)]">{e.full_name}</td><td>{e.emp_code}</td><td className="text-rose-400 font-bold">{formatCurrency(e.total_cpf)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-[var(--text-main)] mb-1">Generated IR8A Forms ({data.year})</h3>
                                        <p className="text-sm text-[var(--text-muted)]">Strictly immutable generated statutory PDFs.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try { await api.generateIR8A(data.year); toast.success('Generated Successfully'); fetchReport(); }
                                            catch (e) { toast.error(e.message) }
                                        }}
                                        className="btn-primary py-1.5 px-4 text-sm"
                                        disabled={data.forms?.length > 0}
                                    >
                                        {data.forms?.length > 0 ? 'Batch Generated' : 'Generate New IR8A Batch'}
                                    </button>
                                </div>
                                <table className="table-theme">
                                    <thead><tr><th>Employee</th><th>ID</th><th>Form Data Extracted</th><th>Status</th><th>Version</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {data.forms?.map((f, i) => {
                                            const payload = JSON.parse(f.data_json);
                                            return (
                                                <tr key={i}>
                                                    <td className="text-[var(--text-main)]">{f.full_name}</td>
                                                    <td>{f.emp_code}</td>
                                                    <td className="text-xs space-y-1">
                                                        <p>Gross: {formatCurrency(payload.gross_salary)}</p>
                                                        <p>Bonus: {formatCurrency(payload.bonus)}</p>
                                                    </td>
                                                    <td><span className={f.status === 'Amended' ? 'badge-info' : 'badge-success'}>{f.status}</span></td>
                                                    <td className="font-mono text-[var(--text-muted)]">v{f.version}</td>
                                                    <td>
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm('Recalculate and generate an Amendment for this employee?')) {
                                                                    try {
                                                                        const res = await api.amendIR8A(data.year, f.employee_id);
                                                                        toast.success(res.message);
                                                                        if (res.requiresFormSG) {
                                                                            window.open(res.formSgUrl, '_blank');
                                                                            toast('Complete FormSG for back-year amendment!', { icon: '⚠️' })
                                                                        }
                                                                        fetchReport();
                                                                    } catch (e) { toast.error(e.message) }
                                                                }
                                                            }}
                                                            className="text-amber-400 text-xs hover:underline"
                                                        >Amend</button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {(!data.forms || data.forms.length === 0) && (
                                            <tr><td colSpan="6" className="text-center py-4 text-[var(--text-muted)]">No forms generated yet for {data.year}.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* AUDIT LOGS */}
                            <div className="pt-6 border-t border-[var(--border-main)]">
                                <h3 className="text-lg font-semibold text-[var(--text-main)] mb-2">Submission Audit Trail</h3>
                                <table className="table-theme w-full text-sm">
                                    <thead><tr><th>Timestamp</th><th>User</th><th>Submission Type</th><th>Records</th></tr></thead>
                                    <tbody>
                                        {data.logs?.slice(0, 5).map((log, i) => (
                                            <tr key={i}>
                                                <td className="text-[var(--text-muted)]">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="text-[var(--text-main)]">{log.username}</td>
                                                <td><span className={log.submission_type.includes('Original') ? 'badge-success' : 'badge-info'}>{log.submission_type}</span></td>
                                                <td>{log.records_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SDL Report */}
                    {tab === 'sdl' && (
                        <>
                            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-1">Skills Development Levy Report</h3>
                            <p className="text-sm text-[var(--text-muted)] mb-2">{data.period}</p>
                            <p className="text-sm text-[var(--brand-primary)] mb-4">Total SDL: <span className="font-bold">{formatCurrency(data.totalSDL)}</span> (rounded down to nearest dollar)</p>
                            <table className="table-theme">
                                <thead><tr><th>Employee</th><th>ID</th><th>Gross Pay</th><th>SDL</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-[var(--text-main)]">{e.employee_name}</td><td>{e.employee_code}</td><td>{formatCurrency(e.gross_pay)}</td><td>{formatCurrency(e.sdl)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* SHG Report */}
                    {tab === 'shg' && (
                        <>
                            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-1">Self-Help Group Deductions Report</h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">{data.period}</p>
                            {data.byFund && (
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    {Object.entries(data.byFund).map(([fund, info]) => (
                                        <div key={fund} className="p-3 rounded-xl bg-[var(--bg-input)]">
                                            <p className="text-xs text-[var(--text-muted)]">{fund}</p>
                                            <p className="text-lg font-bold text-[var(--text-main)]">{formatCurrency(info.total)}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{info.count} employee(s)</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <table className="table-theme">
                                <thead><tr><th>Employee</th><th>ID</th><th>Fund</th><th>Deduction</th></tr></thead>
                                <tbody>
                                    {data.employees?.map((e, i) => (
                                        <tr key={i}><td className="text-[var(--text-main)]">{e.employee_name}</td><td>{e.employee_code}</td><td><span className="badge-info">{e.shg_fund}</span></td><td>{formatCurrency(e.shg_deduction)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {(!data.employees && tab !== 'ir8a') || (data.employees?.length === 0) ? (
                        <p className="text-center py-8 text-[var(--text-muted)]">No data found for this period. Process a payroll run first.</p>
                    ) : null}
                </div>
            )}
        </div>
    )
}
