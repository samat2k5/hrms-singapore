import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatMonth } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

export default function Payroll() {
    const { activeEntity } = useAuth()
    const [runs, setRuns] = useState([])
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [employeeGroup, setEmployeeGroup] = useState('General')
    const [selectedRun, setSelectedRun] = useState(null)
    const [payslips, setPayslips] = useState([])
    const [giroFormat, setGiroFormat] = useState('DBS')

    // Pre-Processing State
    const [isPreProcessing, setIsPreProcessing] = useState(false)
    const [preProcessEmployees, setPreProcessEmployees] = useState([])
    const [modifiers, setModifiers] = useState({})
    // Format: { [empId]: { allowanceLabel: '', allowanceValue: 0, deductionLabel: '', deductionValue: 0 } }

    // Timesheet Upload State
    const [showTimesheetModal, setShowTimesheetModal] = useState(false)
    const [timesheetFile, setTimesheetFile] = useState(null)
    const [uploading, setUploading] = useState(false)

    const navigate = useNavigate()

    const load = async () => {
        if (!activeEntity) return;
        setLoading(true);
        try {
            const [fetchedRuns, fetchedGroups] = await Promise.all([
                api.getPayrollRuns(),
                api.getEmployeeGroups()
            ]);
            setRuns(fetchedRuns);
            setGroups(fetchedGroups);
            if (fetchedGroups.length > 0 && !fetchedGroups.find(g => g.name === employeeGroup)) {
                setEmployeeGroup(fetchedGroups[0].name);
            }
        } catch (e) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() }, [activeEntity?.id])

    const handleInitializeRun = async () => {
        try {
            setProcessing(true)
            const allEmps = await api.getEmployees()
            // Filter active by group
            const groupEmps = allEmps.filter(e => e.status === 'Active' && e.employee_group === employeeGroup)

            if (groupEmps.length === 0) {
                toast.error(`No active employees found in group: ${employeeGroup}`)
                setProcessing(false)
                return
            }

            // Hydrate the matrix inputs map
            const initialMap = {}
            groupEmps.forEach(e => {
                let aKey = '', aVal = '', dKey = '', dVal = ''
                try {
                    const existingA = JSON.parse(e.custom_allowances || '{}')
                    const existingD = JSON.parse(e.custom_deductions || '{}')

                    const aKeys = Object.keys(existingA)
                    if (aKeys.length > 0) {
                        aKey = aKeys[0]
                        aVal = existingA[aKey]
                    }

                    const dKeys = Object.keys(existingD)
                    if (dKeys.length > 0) {
                        dKey = dKeys[0]
                        dVal = existingD[dKey]
                    }
                } catch (err) { /* ignore parse errors */ }

                initialMap[e.id] = {
                    allowanceLabel: aKey, allowanceValue: aVal,
                    deductionLabel: dKey, deductionValue: dVal
                }
            })

            setPreProcessEmployees(groupEmps)
            setModifiers(initialMap)
            setIsPreProcessing(true)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setProcessing(false)
        }
    }

    const handleModifierChange = (empId, field, value) => {
        setModifiers(prev => ({
            ...prev,
            [empId]: {
                ...(prev[empId] || {}), // safe hydration fallback
                [field]: value
            }
        }))
    }

    const handleRun = async () => {
        if (!window.confirm(`Process payroll for ${employeeGroup} in ${formatMonth(year, month)}?`)) return
        setProcessing(true)
        try {
            // 1. Bulk Update Custom Allowances & Deductions
            const records = preProcessEmployees.map(e => {
                const mod = modifiers[e.id] || {}
                const customA = mod.allowanceLabel ? { [mod.allowanceLabel]: Number(mod.allowanceValue) || 0 } : {}
                const customD = mod.deductionLabel ? { [mod.deductionLabel]: Number(mod.deductionValue) || 0 } : {}
                return { id: e.id, custom_allowances: customA, custom_deductions: customD }
            })
            await api.updateBulkCustomModifiers(records)

            // 2. Process Final Payroll Hook
            const result = await api.runGroupPayroll(year, month, employeeGroup)
            toast.success(`Payroll processed for ${result.payslips.length} employees`)
            setSelectedRun(result.run)
            setPayslips(result.payslips)
            setIsPreProcessing(false)
            load()
        } catch (err) {
            toast.error(err.message)
        } finally {
            setProcessing(false)
        }
    }

    const viewRun = async (run) => {
        try {
            const result = await api.getPayrollRun(run.id)
            setSelectedRun(result.run)
            setPayslips(result.payslips)
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this payroll run and all associated payslips?')) return
        try {
            await api.deletePayrollRun(id)
            toast.success('Payroll run deleted')
            setSelectedRun(null)
            setPayslips([])
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const downloadExport = (path, filename) => {
        const token = localStorage.getItem('hrms_token');
        fetch(path, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
            });
    }

    const handleTimesheetUpload = async (e) => {
        e.preventDefault()
        if (!timesheetFile) return toast.error('Please select a CSV file.')

        const formData = new FormData()
        formData.append('file', timesheetFile)

        setUploading(true)
        try {
            const res = await api.uploadTimesheet(formData)
            toast.success(`Success! Uploaded ${res.successCount} records.`)
            if (res.errors && res.errors.length > 0) {
                toast.error(`There were ${res.errors.length} parsing errors. Check console for details.`, { duration: 6000 })
                console.error('Timesheet Errors:', res.errors)
            }
            setShowTimesheetModal(false)
            setTimesheetFile(null)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setUploading(false)
        }
    }

    const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i).toLocaleString('en-SG', { month: 'long' }) }))

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-[var(--text-main)]">Payroll Processing</h1>
                <p className="text-[var(--text-muted)] mt-1">Run monthly payroll with CPF, SDL & SHG compliance</p>
            </div>

            {/* Run Payroll Section */}
            <div className="card-base p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text-main)]">Process New Payroll</h3>
                    <button onClick={() => setShowTimesheetModal(true)} className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all text-sm flex items-center justify-center sm:justify-start gap-2">
                        <span>📄</span> Import Timesheets
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-[var(--text-muted)] mb-1.5">Group</label>
                        <select value={employeeGroup} onChange={e => setEmployeeGroup(e.target.value)} className="select-base w-full sm:w-40">
                            {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-[var(--text-muted)] mb-1.5">Month</label>
                        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select-base w-full sm:w-40">
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-[var(--text-muted)] mb-1.5">Year</label>
                        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="select-base w-full sm:w-32">
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    {!isPreProcessing ? (
                        <button onClick={handleInitializeRun} disabled={processing} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
                            {processing ? <div className="w-4 h-4 border-2 border-[var(--border-main)] border-t-white rounded-full animate-spin" /> : '⚙️'}
                            {processing ? 'Loading...' : 'Initialize Run'}
                        </button>
                    ) : (
                        <button onClick={() => setIsPreProcessing(false)} className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all text-sm text-center">
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Pre-Processing Matrix Panel */}
            {isPreProcessing && !selectedRun && (
                <div className="card-base p-6 animate-slide-up border border-[var(--brand-primary)]/30">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--text-main)]">Pre-Processing Modifier Matrix</h3>
                            <p className="text-sm text-[var(--text-muted)]">Bulk apply specific 1-off allowances and deductions before hitting the Run Engine.</p>
                        </div>
                        <button onClick={handleRun} disabled={processing} className="btn-primary flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20">
                            {processing ? <div className="w-4 h-4 border-2 border-[var(--border-main)] border-t-white rounded-full animate-spin" /> : '🚀'}
                            Finalize & Run Payroll
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-theme">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Basic Salary</th>
                                    <th>Custom Allowance Label</th>
                                    <th>Allowance ($)</th>
                                    <th>Custom Deduction Label</th>
                                    <th>Deduction ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preProcessEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-[var(--bg-input)] transition-colors">
                                        <td>
                                            <p className="font-medium text-[var(--text-main)]">{emp.full_name}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{emp.employee_id}</p>
                                        </td>
                                        <td className="text-[var(--text-muted)] font-medium">{formatCurrency(emp.basic_salary)}</td>
                                        <td>
                                            <input
                                                type="text"
                                                placeholder="e.g. Perf Bonus"
                                                value={modifiers[emp.id]?.allowanceLabel || ''}
                                                onChange={(e) => handleModifierChange(emp.id, 'allowanceLabel', e.target.value)}
                                                className="input-base !py-1.5 !text-sm w-36"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={modifiers[emp.id]?.allowanceValue || ''}
                                                onChange={(e) => handleModifierChange(emp.id, 'allowanceValue', e.target.value)}
                                                className="input-base !py-1.5 !text-sm w-24 text-emerald-400"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                placeholder="e.g. Uniform Fee"
                                                value={modifiers[emp.id]?.deductionLabel || ''}
                                                onChange={(e) => handleModifierChange(emp.id, 'deductionLabel', e.target.value)}
                                                className="input-base !py-1.5 !text-sm w-36"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={modifiers[emp.id]?.deductionValue || ''}
                                                onChange={(e) => handleModifierChange(emp.id, 'deductionValue', e.target.value)}
                                                className="input-base !py-1.5 !text-sm w-24 text-red-400"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Payslip Results */}
            {selectedRun && (
                <div className="card-base p-6 animate-slide-up">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--text-main)]">
                                {formatMonth(selectedRun.period_year, selectedRun.period_month)} — Payroll Results
                            </h3>
                            <div className="flex gap-6 mt-2">
                                <span className="text-sm text-[var(--text-muted)]">Gross: <span className="text-[var(--text-main)] font-medium">{formatCurrency(selectedRun.total_gross)}</span></span>
                                <span className="text-sm text-[var(--text-muted)]">CPF: <span className="text-blue-400 font-medium">{formatCurrency(selectedRun.total_cpf_employee + selectedRun.total_cpf_employer)}</span></span>
                                <span className="text-sm text-[var(--text-muted)]">Net: <span className="text-[var(--brand-primary)] font-medium">{formatCurrency(selectedRun.total_net)}</span></span>
                            </div>
                        </div>
                        <button onClick={() => setSelectedRun(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-xl">×</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-theme">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Basic</th>
                                    <th>Allowances</th>
                                    <th>OT Pay ($)</th>
                                    <th>Perf. Allow ($)</th>
                                    <th>Att. Pen ($)</th>
                                    <th>Gross</th>
                                    <th>CPF (EE)</th>
                                    <th>CPF (ER)</th>
                                    <th>SDL</th>
                                    <th>SHG</th>
                                    <th>Net Pay</th>
                                    <th className="sticky right-0 bg-[var(--bg-card)] z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.05)] border-l border-[var(--border-main)] text-center">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payslips.map(ps => (
                                    <tr key={ps.id}>
                                        <td>
                                            <div>
                                                <p className="font-medium text-[var(--text-main)]">{ps.employee_name}</p>
                                                <p className="text-xs text-[var(--text-muted)]">{ps.employee_code}</p>
                                            </div>
                                        </td>
                                        <td>{formatCurrency(ps.basic_salary)}</td>
                                        <td>{formatCurrency(ps.total_allowances)}</td>
                                        <td>
                                            <span className={ps.overtime_pay > 0 ? "text-amber-400 font-medium" : "text-[var(--text-muted)]"}>
                                                {formatCurrency(ps.overtime_pay)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={ps.performance_allowance > 0 ? "text-emerald-400 font-medium" : "text-[var(--text-muted)]"}>
                                                {formatCurrency(ps.performance_allowance)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className={ps.attendance_deduction > 0 ? "text-rose-400 font-medium" : "text-[var(--text-muted)]"}>
                                                    -{formatCurrency(ps.attendance_deduction)}
                                                </span>
                                                {(ps.late_mins > 0 || ps.early_out_mins > 0) && (
                                                    <span className="text-[10px] text-rose-500/70">
                                                        {ps.late_mins}L / {ps.early_out_mins}E mins
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="font-medium text-[var(--text-main)]">{formatCurrency(ps.gross_pay)}</td>
                                        <td>{formatCurrency(ps.cpf_employee)}</td>
                                        <td>{formatCurrency(ps.cpf_employer)}</td>
                                        <td>{formatCurrency(ps.sdl)}</td>
                                        <td>
                                            <div>
                                                <span>{formatCurrency(ps.shg_deduction)}</span>
                                                {ps.shg_fund !== 'N/A' && <span className="text-xs text-[var(--text-muted)] ml-1">({ps.shg_fund})</span>}
                                            </div>
                                        </td>
                                        <td className="font-semibold text-[var(--brand-primary)]">{formatCurrency(ps.net_pay)}</td>
                                        <td className="sticky right-0 bg-[var(--bg-card)] z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.05)] border-l border-[var(--border-main)] text-center">
                                            <button onClick={() => navigate(`/payroll/payslip/${ps.id}`)}
                                                className="text-xs px-3 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-colors whitespace-nowrap">
                                                📄 Payslip
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="card-base p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text-main)]">Payroll History</h3>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--text-muted)] uppercase font-bold">GIRO Format:</label>
                        <select
                            value={giroFormat}
                            onChange={e => setGiroFormat(e.target.value)}
                            className="select-base !py-1 !px-2 !text-xs w-32"
                        >
                            <option value="DBS">DBS (CSV)</option>
                            <option value="OCBC">OCBC (TXT)</option>
                            <option value="UOB">UOB (TXT)</option>
                            <option value="APS">Interbank APS</option>
                        </select>
                    </div>
                </div>
                {loading ? <div className="h-32 loading-shimmer" /> : runs.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-center py-8">No payroll runs yet. Process your first payroll above.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-theme">
                            <thead>
                                <tr>
                                    <th>Group</th>
                                    <th>Period</th>
                                    <th>Total Gross</th>
                                    <th>CPF Total</th>
                                    <th>SDL</th>
                                    <th>Net Pay</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map(run => (
                                    <tr key={run.id}>
                                        <td><span className="badge-neutral">{run.employee_group}</span></td>
                                        <td className="font-medium text-[var(--text-main)]">{formatMonth(run.period_year, run.period_month)}</td>
                                        <td>{formatCurrency(run.total_gross)}</td>
                                        <td>{formatCurrency(run.total_cpf_employee + run.total_cpf_employer)}</td>
                                        <td>{formatCurrency(run.total_sdl)}</td>
                                        <td className="font-medium text-[var(--brand-primary)]">{formatCurrency(run.total_net)}</td>
                                        <td><span className="badge-success">{run.status}</span></td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button onClick={() => {
                                                    const ext = giroFormat === 'DBS' ? 'csv' : 'txt';
                                                    downloadExport(`/api/payroll/export-giro/${run.id}?format=${giroFormat}`, `GIRO_${giroFormat}_${run.employee_group}.${ext}`);
                                                }} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title={`${giroFormat} GIRO Export`}>🏦 GIRO</button>
                                                <button onClick={() => downloadExport(`/api/payroll/export-cpf/${run.id}`, `CPF_${run.employee_group}.txt`)} className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="CPF FTP File">📥 CPF</button>
                                                <button onClick={() => viewRun(run)} className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors">View</button>
                                                <button onClick={() => handleDelete(run.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Timesheet Upload Modal */}
            {showTimesheetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card-base p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Import Timesheets</h2>
                            <button onClick={() => setShowTimesheetModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl">×</button>
                        </div>
                        <p className="text-[var(--text-muted)] text-sm mb-6">
                            Upload a CSV file containing Employee ID, Date, and OT Hours to calculate overtime during the next payroll run.
                        </p>
                        <form onSubmit={handleTimesheetUpload} className="space-y-4">
                            <div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    required
                                    onChange={(e) => setTimesheetFile(e.target.files[0])}
                                    className="w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand-primary)]/10 file:text-[var(--brand-primary)] hover:file:bg-cyan-500/20 input-base !p-2"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-[var(--border-main)] mt-4">
                                <button type="button" onClick={() => setShowTimesheetModal(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">Cancel</button>
                                <button type="submit" disabled={uploading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                                    {uploading ? <div className="w-4 h-4 border-2 border-[var(--border-main)] border-t-white rounded-full animate-spin" /> : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
