import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Attendance() {
    const { activeEntity } = useAuth()
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [stats, setStats] = useState(null)

    // Selectors state
    const [employees, setEmployees] = useState([])
    const [selectedEmployee, setSelectedEmployee] = useState('')
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

    // Matrix state
    const [matrixData, setMatrixData] = useState([])
    const [loadingMatrix, setLoadingMatrix] = useState(false)
    const [savingMatrix, setSavingMatrix] = useState(false)

    useEffect(() => {
        if (activeEntity) {
            fetchEmployees()
        }
    }, [activeEntity])

    const fetchEmployees = async () => {
        try {
            const data = await api.getEmployees()
            setEmployees(data)
        } catch (err) {
            toast.error("Failed to load employees for dropdown")
        }
    }

    const loadMatrix = async () => {
        if (!selectedEmployee) return
        setLoadingMatrix(true)
        try {
            // Get exact days in selected month
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()

            // Fetch any existing records targeting this month
            const existingRecords = await api.getMonthlyTimesheets(selectedEmployee, selectedYear, selectedMonth)

            // Build the 31-day array
            const newMatrix = []
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`

                // See if db has this date already
                const existing = existingRecords.find(r => r.date === dateStr)

                newMatrix.push({
                    date: dateStr,
                    dayOfWeek: new Date(dateStr).getDay(),
                    in_time: existing?.in_time || '',
                    out_time: existing?.out_time || '',
                    shift: existing?.shift || 'Day',
                    ot_hours: existing?.ot_hours || 0,
                    remarks: existing?.remarks || ''
                })
            }

            setMatrixData(newMatrix)
        } catch (err) {
            toast.error("Failed to load monthly matrix")
        } finally {
            setLoadingMatrix(false)
        }
    }

    // Auto-fetch matrix when selectors change (if an employee is chosen)
    useEffect(() => {
        if (selectedEmployee) {
            loadMatrix()
        } else {
            setMatrixData([])
        }
    }, [selectedEmployee, selectedYear, selectedMonth])

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.xlsx')) {
                toast.error('Please upload an Excel file (.xlsx)')
                return
            }
            setFile(selectedFile)
        }
    }

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)
        setStats(null)

        const formData = new FormData()
        formData.append('file', file)

        // Pass month parameter to import if necessary (optional depending on backend parser)
        formData.append('month', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`)

        try {
            const res = await api.uploadAttendance(formData)
            toast.success('Attendance imported successfully')
            setStats(res.results)
            setFile(null)
            if (selectedEmployee) loadMatrix() // Refresh matrix if viewing an employee bounds
        } catch (err) {
            toast.error(err.message || 'Import failed')
        } finally {
            setUploading(false)
        }
    }

    const applyBasicPattern = () => {
        const updated = matrixData.map(row => {
            // 1 to 5 means Monday to Friday
            if (row.dayOfWeek >= 1 && row.dayOfWeek <= 5) {
                return {
                    ...row,
                    in_time: row.in_time || '0800', // Only fill if empty to avoid wiping out genuine OT
                    out_time: row.out_time || '1730',
                    shift: 'Day'
                }
            }
            return row
        })
        setMatrixData(updated)
        toast.success("Applied basic weekday hours to empty blocks")
    }

    const handleMatrixChange = (index, field, value) => {
        const updated = [...matrixData]
        updated[index][field] = value
        setMatrixData(updated)
    }

    const saveMatrix = async () => {
        if (!selectedEmployee) return

        // Filter out completely empty rows to avoid saving junk, unless they had data before and HR explicitly wiped them
        // Actually, for simplicity and strict overrides, UPSERT the whole array so HR can explicitly blank out days

        setSavingMatrix(true)
        try {
            await api.saveMonthlyTimesheets(selectedEmployee, matrixData)
            toast.success('Monthly overrides saved successfully!')
            loadMatrix()
        } catch (err) {
            toast.error('Failed to save monthly records: ' + err.message)
        } finally {
            setSavingMatrix(false)
        }
    }

    const formatDay = (dateStr) => {
        const d = new Date(dateStr)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        return days[d.getDay()]
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-input)] backdrop-blur-md p-6 rounded-xl border border-[var(--border-main)] shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Time Attendance & Overrides</h1>
                    <p className="text-gray-400">Import excel files or manually override monthly timesheets</p>
                </div>
                <a
                    href="/Attendance_Template.xlsx"
                    download
                    className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-[var(--text-main)] rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                >
                    <span className="text-lg">📥</span>
                    Download Template
                </a>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Upload Zone (1 Column) */}
                <div className="lg:col-span-1 bg-[var(--bg-input)] backdrop-blur-md p-6 rounded-xl border border-[var(--border-main)] shadow-xl space-y-4 h-fit">
                    <h2 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2">
                        <span className="text-xl">☁️</span>
                        Batch Import
                    </h2>

                    <div className="border-2 border-dashed border-[var(--border-main)] rounded-lg p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".xlsx"
                        />
                        <div className="space-y-2">
                            <span className="text-4xl block">📤</span>
                            <p className="text-sm text-gray-300">
                                {file ? file.name : 'Click or drop .xlsx file'}
                            </p>
                            <p className="text-xs text-gray-400">Timesheet Array Upload</p>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-[var(--text-main)] rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                    >
                        {uploading ? (
                            <div className="w-5 h-5 border-2 border-[var(--border-main)] border-t-white rounded-full animate-spin"></div>
                        ) : 'Start Import'}
                    </button>

                    {stats && (
                        <div className="mt-4 p-4 bg-[var(--bg-input)] rounded-lg border border-[var(--border-main)] text-sm">
                            <h3 className="text-indigo-400 font-semibold mb-2">Import Results:</h3>
                            <ul className="space-y-1 text-gray-300">
                                <li>✅ Processed: {stats.processed}</li>
                                <li>⏭️ Skipped: {stats.skipped}</li>
                                {stats.errors.length > 0 && (
                                    <li className="text-red-400">❌ Errors: {stats.errors.length}</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Monthly Matrix Zone (3 Columns) */}
                <div className="lg:col-span-3 bg-[var(--bg-input)] backdrop-blur-md p-6 rounded-xl border border-[var(--border-main)] shadow-xl overflow-hidden flex flex-col">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h2 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2 whitespace-nowrap">
                            <span className="text-xl">📅</span>
                            Monthly Grid Override
                        </h2>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(parseInt(e.target.value))}
                                className="select-base w-24 py-1.5 border-indigo-500/30 text-sm"
                            >
                                {[...Array(5)].map((_, i) => {
                                    const y = new Date().getFullYear() - i;
                                    return <option key={y} value={y}>{y}</option>
                                })}
                            </select>

                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                                className="select-base w-32 py-1.5 border-indigo-500/30 text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>

                            <select
                                value={selectedEmployee}
                                onChange={e => setSelectedEmployee(e.target.value)}
                                className="select-base w-48 py-1.5 border-indigo-500/30 text-sm"
                            >
                                <option value="">-- Select Employee --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Matrix Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-black/20 p-3 rounded-lg border border-[var(--border-main)] mb-4">
                        <button
                            onClick={applyBasicPattern}
                            disabled={!selectedEmployee}
                            className="w-full sm:w-auto px-3 py-1.5 bg-sky-600/30 hover:bg-sky-500/50 text-sky-300 rounded border border-sky-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            ⚡ Apply Standard Hours (M-F)
                        </button>

                        <button
                            onClick={saveMatrix}
                            disabled={!selectedEmployee || savingMatrix}
                            className="w-full sm:w-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-main)] rounded shadow-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {savingMatrix ? 'Saving...' : '💾 Save Changes'}
                        </button>
                    </div>

                    {/* Data Grid */}
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-[var(--border-main)] rounded-lg">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--bg-input)] text-gray-300 text-xs uppercase sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-3 py-3 w-28 whitespace-nowrap">Date</th>
                                    <th className="px-3 py-3 w-20">Day</th>
                                    <th className="px-2 py-3 w-28 text-center">In Time</th>
                                    <th className="px-2 py-3 w-28 text-center">Out Time</th>
                                    <th className="px-2 py-3 w-28 text-center">Shift</th>
                                    <th className="px-2 py-3 w-24 text-center">OT Hrs</th>
                                    <th className="px-3 py-3">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-black/10">
                                {loadingMatrix ? (
                                    <tr><td colSpan="7" className="text-center py-8 text-gray-400">Loading Matrix...</td></tr>
                                ) : matrixData.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-12 text-gray-500 italic">Select an employee to expand their monthly tracking matrix.</td></tr>
                                ) : (
                                    matrixData.map((row, idx) => (
                                        <tr key={idx} className={`hover:bg-[var(--bg-input)] text-sm transition-colors ${row.dayOfWeek === 0 || row.dayOfWeek === 6 ? 'bg-red-500/5' : ''}`}>
                                            <td className="px-3 py-1.5 text-gray-300 font-mono text-xs">{row.date}</td>
                                            <td className={`px-3 py-1.5 font-medium ${row.dayOfWeek === 0 ? 'text-rose-400' : row.dayOfWeek === 6 ? 'text-amber-400' : 'text-gray-400'}`}>
                                                {formatDay(row.date)}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="text"
                                                    maxLength={4}
                                                    placeholder="0800"
                                                    value={row.in_time}
                                                    onChange={e => handleMatrixChange(idx, 'in_time', e.target.value)}
                                                    className="w-16 bg-[var(--bg-input)] border border-[var(--border-main)] rounded px-2 py-1 text-center text-[var(--text-main)] focus:border-indigo-500 focus:bg-indigo-500/10 placeholder-gray-600 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="text"
                                                    maxLength={4}
                                                    placeholder="1730"
                                                    value={row.out_time}
                                                    onChange={e => handleMatrixChange(idx, 'out_time', e.target.value)}
                                                    className="w-16 bg-[var(--bg-input)] border border-[var(--border-main)] rounded px-2 py-1 text-center text-[var(--text-main)] focus:border-indigo-500 focus:bg-indigo-500/10 placeholder-gray-600 outline-none font-mono"
                                                />
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <select
                                                    value={row.shift}
                                                    onChange={e => handleMatrixChange(idx, 'shift', e.target.value)}
                                                    className="w-20 bg-[var(--bg-input)] border border-[var(--border-main)] rounded px-1 py-1 text-center text-gray-300 focus:border-indigo-500 outline-none text-xs"
                                                >
                                                    <option value="Day">Day</option>
                                                    <option value="Night">Night</option>
                                                </select>
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="number"
                                                    step="0.25"
                                                    min="0"
                                                    value={row.ot_hours}
                                                    onChange={e => handleMatrixChange(idx, 'ot_hours', parseFloat(e.target.value) || 0)}
                                                    className="w-16 bg-[var(--bg-input)] border border-[var(--border-main)] rounded px-2 py-1 text-center text-amber-300 font-bold focus:border-amber-500 focus:bg-amber-500/10 outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    placeholder="Optional remarks..."
                                                    value={row.remarks}
                                                    onChange={e => handleMatrixChange(idx, 'remarks', e.target.value)}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-[var(--border-main)] focus:border-indigo-500 rounded-none px-1 py-1 text-gray-300 outline-none text-xs"
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
