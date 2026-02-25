import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Attendance() {
    const { activeEntity } = useAuth()
    const [files, setFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [stats, setStats] = useState(null)
    const [scanResults, setScanResults] = useState(null)
    const [showErrorList, setShowErrorList] = useState(false)
    const [showImport, setShowImport] = useState(false)

    // Selectors state
    const [entities, setEntities] = useState([])
    const [selectedEntityId, setSelectedEntityId] = useState(activeEntity?.id || '')
    const [employees, setEmployees] = useState([])
    const [empSearchTerm, setEmpSearchTerm] = useState('')
    const [selectedEmployee, setSelectedEmployee] = useState('')
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

    // Matrix state
    const [matrixData, setMatrixData] = useState([])
    const [holidays, setHolidays] = useState([])
    const [loadingMatrix, setLoadingMatrix] = useState(false)
    const [savingMatrix, setSavingMatrix] = useState(false)

    useEffect(() => {
        fetchEntities()
    }, [])

    useEffect(() => {
        if (selectedEntityId) {
            fetchEmployees()
            setSelectedEmployee('') // Reset employee when entity changes
        }
    }, [selectedEntityId])

    const fetchEntities = async () => {
        try {
            const data = await api.getEntities()
            setEntities(data)
            if (!selectedEntityId && data.length > 0) {
                setSelectedEntityId(data[0].id)
            }
        } catch (err) {
            toast.error("Failed to load entities")
        }
    }

    const fetchEmployees = async () => {
        try {
            const data = await api.getEmployees(selectedEntityId)
            setEmployees(data)
        } catch (err) {
            toast.error("Failed to load employees for dropdown")
        }
    }

    const fetchHolidays = async () => {
        try {
            const data = await api.getHolidays(selectedYear, selectedMonth, selectedEntityId)
            setHolidays(data)
        } catch (err) {
            console.error("Failed to fetch holidays")
        }
    }

    const loadMatrix = async () => {
        if (!selectedEmployee) return
        setLoadingMatrix(true)
        try {
            // Fetch holidays first for highlighting
            const hData = await api.getHolidays(selectedYear, selectedMonth, selectedEntityId)
            setHolidays(hData)

            // Get exact days in selected month
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()

            // Fetch any existing records targeting this month
            const existingRecords = await api.getMonthlyTimesheets(selectedEmployee, selectedYear, selectedMonth, selectedEntityId)

            // Build the 31-day array
            const newMatrix = []
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`

                // See if db has this date already
                const existing = existingRecords.find(r => r.date === dateStr)

                let rowData = {
                    date: dateStr,
                    dayOfWeek: new Date(dateStr).getDay(),
                    in_time: existing?.in_time || '',
                    out_time: existing?.out_time || '',
                    shift: existing?.shift || '',
                    normal_hours: existing?.normal_hours === undefined ? '' : existing.normal_hours,
                    ot_hours: existing?.ot_hours === undefined ? '' : existing.ot_hours,
                    ot_1_5_hours: existing?.ot_1_5_hours === undefined ? '' : existing.ot_1_5_hours,
                    ot_2_0_hours: existing?.ot_2_0_hours === undefined ? '' : existing.ot_2_0_hours,
                    ph_hours: existing?.ph_hours === undefined ? '' : existing.ph_hours,
                    performance_credit: existing?.performance_credit === undefined ? '' : existing.performance_credit,
                    remarks: existing?.remarks || ''
                }

                // Auto-calculate hours if they are essentially zero/empty but times exist
                if (rowData.in_time && rowData.out_time && (!rowData.normal_hours || rowData.normal_hours === 0)) {
                    rowData = calculateCategorizedHours(rowData)
                }

                newMatrix.push(rowData)
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
            fetchHolidays() // Fetch holidays even if no employee selected to show highlighting? 
            // Actually, matrix is only built when employee selected.
        }
    }, [selectedEmployee, selectedYear, selectedMonth])

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files)
        const validFiles = selectedFiles.filter(f => f.name.endsWith('.xlsx'))

        if (validFiles.length < selectedFiles.length) {
            toast.error('Only Excel files (.xlsx) are allowed')
        }

        setFiles(prev => [...prev, ...validFiles])
        setScanResults(null)
        setStats(null)
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        setScanResults(null)
        setStats(null)
    }

    const handleScan = async () => {
        if (files.length === 0) return
        setScanning(true)
        setStats(null)
        setScanResults(null)

        const formData = new FormData()
        files.forEach(f => formData.append('files', f))
        formData.append('dryRun', 'true')

        try {
            const res = await api.uploadAttendance(formData)
            setScanResults(res.results)
            toast.success('Scan completed. Please review before confirming.')
        } catch (err) {
            toast.error(err.message || 'Scan failed')
        } finally {
            setScanning(false)
        }
    }

    const handleUpload = async () => {
        if (files.length === 0) return
        setUploading(true)

        const formData = new FormData()
        files.forEach(f => formData.append('files', f))
        formData.append('dryRun', 'false')

        try {
            const res = await api.uploadAttendance(formData)
            toast.success('Attendance batch imported successfully')
            setStats(res.results)
            setFiles([])
            setScanResults(null)
            if (selectedEmployee) loadMatrix()
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

    const calculateCategorizedHours = (row) => {
        const inStr = row.in_time ? row.in_time.replace(':', '') : ''
        const outStr = row.out_time ? row.out_time.replace(':', '') : ''

        if (inStr.length < 3 || outStr.length < 3) {
            return {
                ...row,
                normal_hours: 0,
                ot_hours: 0,
                ot_1_5_hours: 0,
                ot_2_0_hours: 0,
                ph_hours: 0
            }
        }

        const inTime = parseInt(inStr)
        const outTime = parseInt(outStr)
        const isWeekend = row.dayOfWeek === 0 || row.dayOfWeek === 6
        const isHoliday = holidays.some(h => h.date === row.date)

        const timeToMins = (t) => Math.floor(t / 100) * 60 + (t % 100)
        let inMins = timeToMins(inTime)
        let outMins = timeToMins(outTime)

        // Assume default 0730 - 1630 shift for manual calc if row.shift is Day or empty
        // OT now starts at 1630
        let shiftStartMins = 7 * 60 + 30
        let shiftEndMins = 16 * 60 + 30
        let otStartMins = 16 * 60 + 30

        if (row.shift?.toLowerCase().includes('night')) {
            shiftStartMins = 18 * 60 + 30
            shiftEndMins = 4 * 60 + 30 + 1440
            otStartMins = 4 * 60 + 30 + 1440
        }

        if (outMins <= inMins && inMins >= 1000) outMins += 1440 // Overnight

        let normal = 0
        let ot = 0
        let ot15 = 0
        let ot20 = 0
        let ph = 0

        // Basic calculation logic
        if (outMins > inMins) {
            const totalDuration = (outMins - inMins) / 60
            const workedDurationMinusLunch = Math.max(0, totalDuration - 1) // 1h lunch

            if (row.dayOfWeek === 6) {
                // Saturday: First 4h are Normal (Basic), rest are 1.5x OT
                normal = Math.min(4, workedDurationMinusLunch)
                ot15 = Math.max(0, workedDurationMinusLunch - 4)
            } else if (row.dayOfWeek === 0) {
                // Sunday: All 2.0x OT
                normal = 0
                ot20 = workedDurationMinusLunch
            } else if (isHoliday) {
                // PH: 8h Normal, rest 2.0x OT
                normal = Math.min(8, workedDurationMinusLunch)
                ph = normal
                ot20 = Math.max(0, workedDurationMinusLunch - 8)
            } else {
                // Weekday: 8h Normal, rest 1.5x OT
                normal = Math.min(8, workedDurationMinusLunch)
                ot15 = Math.max(0, workedDurationMinusLunch - 8)
            }
        }

        return {
            ...row,
            normal_hours: normal,
            ot_hours: ot15 + ot20, // Sum of all OT
            ot_1_5_hours: ot15,
            ot_2_0_hours: ot20,
            ph_hours: ph
        }
    }

    const handleMatrixChange = (index, field, value) => {
        const updated = [...matrixData]
        updated[index][field] = value

        // Auto-calculate if in/out changed
        if (field === 'in_time' || field === 'out_time' || field === 'shift') {
            updated[index] = calculateCategorizedHours(updated[index])
        }

        setMatrixData(updated)
    }

    const saveMatrix = async () => {
        if (!selectedEmployee) return

        // Filter out completely empty rows to avoid saving junk, unless they had data before and HR explicitly wiped them
        // Actually, for simplicity and strict overrides, UPSERT the whole array so HR can explicitly blank out days

        setSavingMatrix(true)
        try {
            await api.saveMonthlyTimesheets(selectedEmployee, matrixData, selectedEntityId)
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
            <header className="flex flex-col sm:flex-row justify-between items-center bg-[var(--bg-input)] backdrop-blur-md p-6 rounded-xl border border-[var(--border-main)] shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Time Attendance & Overrides</h1>
                    <p className="text-gray-400 text-sm">Import biometric data or manually manage monthly records</p>
                </div>
                <button
                    onClick={() => setShowImport(!showImport)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all shadow-lg ${showImport
                        ? "bg-slate-700 text-gray-300 hover:bg-slate-600"
                        : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30"
                        }`}
                >
                    {showImport ? (
                        <><span className="text-lg">✖</span> Close Import Tool</>
                    ) : (
                        <><span className="text-lg">📥</span> Batch Import Tool</>
                    )}
                </button>
            </header>

            {showImport && (
                <div className="bg-[var(--bg-input)] backdrop-blur-md p-8 rounded-xl border border-indigo-500/30 shadow-2xl animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-2xl text-indigo-400 border border-indigo-500/20">📥</div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Batch Attendance Import</h2>
                            <p className="text-sm text-gray-400">Drag and drop your biometric Excel records here</p>
                        </div>
                        <div className="ml-auto flex gap-3">
                            <a
                                href="/Attendance_Template.xlsx"
                                download
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-colors flex items-center gap-2 text-xs font-medium"
                            >
                                📋 Download Template
                            </a>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-indigo-500/30 rounded-xl p-10 text-center hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all cursor-pointer relative group">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept=".xlsx"
                                    multiple
                                />
                                <div className="space-y-3">
                                    <span className="text-4xl block group-hover:scale-110 transition-transform">📂</span>
                                    <p className="text-gray-300 font-medium">Select .xlsx files</p>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Drag & Drop or Click</p>
                                </div>
                            </div>

                            {files.length > 0 && (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5 text-xs animate-in slide-in-from-left-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-indigo-400">📄</span>
                                                <span className="truncate text-gray-300">{f.name}</span>
                                            </div>
                                            <button
                                                onClick={() => removeFile(i)}
                                                className="ml-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-full transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!scanResults && (
                                <button
                                    onClick={handleScan}
                                    disabled={files.length === 0 || scanning}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3"
                                >
                                    {scanning ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <><span className="text-lg">🔍</span> Scan & Preview Records</>
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {scanResults ? (
                                <div className="p-6 rounded-xl bg-slate-900/50 border border-[#00f2fe]/20 shadow-inner h-full flex flex-col">
                                    <h4 className="text-xs font-bold text-[#00f2fe] uppercase tracking-widest mb-6">Import Strategy Preview</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Total Files</p>
                                            <p className="text-2xl font-mono text-white">{scanResults.filesProcessed}</p>
                                        </div>
                                        <div className="bg-black/30 p-4 rounded-xl border border-[#00f2fe]/10">
                                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Row Entries</p>
                                            <p className="text-2xl font-mono text-[#00f2fe]">{scanResults.processed}</p>
                                        </div>
                                    </div>

                                    {scanResults.errors && scanResults.errors.length > 0 && (
                                        <div className="mb-6 flex-1 overflow-hidden flex flex-col">
                                            <button
                                                onClick={() => setShowErrorList(!showErrorList)}
                                                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 font-bold mb-3"
                                            >
                                                {showErrorList ? '▼' : '▶'} Identified Issues ({scanResults.errors.length})
                                            </button>
                                            {showErrorList && (
                                                <div className="flex-1 overflow-y-auto text-[11px] space-y-1.5 p-3 bg-red-500/5 rounded-xl border border-red-500/20 font-mono text-red-300 custom-scrollbar">
                                                    {scanResults.errors.map((err, i) => (
                                                        <div key={i} className="pb-1 border-b border-white/5 last:border-0 opacity-80">{err}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading || scanResults.processed === 0}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 mt-auto"
                                    >
                                        {uploading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <><span className="text-xl">✅</span> Start Cloud Sync</>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="h-full border-2 border-white/5 rounded-xl flex items-center justify-center text-gray-600 italic text-sm">
                                    Scan files to see import summary...
                                </div>
                            )}
                        </div>
                    </div>

                    {stats && (
                        <div className="mt-8 p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/30 animate-in zoom-in-95">
                            <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                                🎊 Import Complete!
                            </h3>
                            <div className="grid grid-cols-3 gap-6 text-sm">
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Processed</p>
                                    <p className="text-xl font-bold text-emerald-400 font-mono">{stats.processed}</p>
                                </div>
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Skipped</p>
                                    <p className="text-xl font-bold text-amber-400 font-mono">{stats.skipped}</p>
                                </div>
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-red-400">
                                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Failures</p>
                                    <p className="text-xl font-bold font-mono">{stats.errors.length}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Monthly Matrix Zone (Full Width) */}
            <div className="w-full bg-[var(--bg-input)] backdrop-blur-md p-8 rounded-xl border border-[var(--border-main)] shadow-xl flex flex-col">
                {/* Header Row: Title and Info */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-xl text-indigo-400 border border-indigo-500/20">📅</div>
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-main)] leading-tight">Monthly Grid Override</h2>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-0.5">Edit daily timesheets manually</p>
                    </div>
                </div>

                {/* Filter & Actions Row (One Row) */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-[var(--border-main)] mb-8 w-full">
                    {/* Filter: Staff Search */}
                    <div className="w-[180px] shrink-0">
                        <input
                            type="text"
                            placeholder="🔍 Filter Staff..."
                            value={empSearchTerm}
                            onChange={e => setEmpSearchTerm(e.target.value)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>

                    {/* Filter: Entity */}
                    <div className="w-[200px] shrink-0">
                        <select
                            value={selectedEntityId}
                            onChange={e => setSelectedEntityId(e.target.value)}
                            className="select-base !py-2 !px-3 !rounded-lg text-sm"
                        >
                            {entities.map(ent => (
                                <option key={ent.id} value={ent.id}>{ent.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter: Year */}
                    <div className="w-[110px] shrink-0">
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                            className="select-base !py-2 !px-3 !rounded-lg text-sm"
                        >
                            {[...Array(5)].map((_, i) => {
                                const y = new Date().getFullYear() - i;
                                return <option key={y} value={y}>{y}</option>
                            })}
                        </select>
                    </div>

                    {/* Filter: Month */}
                    <div className="w-[140px] shrink-0">
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(parseInt(e.target.value))}
                            className="select-base !py-2 !px-3 !rounded-lg text-sm"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter: Employee Selection */}
                    <div className="flex-1 min-w-[240px]">
                        <select
                            value={selectedEmployee}
                            onChange={e => setSelectedEmployee(e.target.value)}
                            className="select-base !py-2 !px-4 !rounded-lg text-sm font-bold border-indigo-500/40"
                        >
                            <option value="">-- Choose Employee --</option>
                            {employees
                                .filter(emp =>
                                    emp.full_name.toLowerCase().includes(empSearchTerm.toLowerCase()) ||
                                    emp.employee_id.toLowerCase().includes(empSearchTerm.toLowerCase())
                                )
                                .map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id})</option>)}
                        </select>
                    </div>

                    {/* Primary Action Button */}
                    <button
                        onClick={loadMatrix}
                        disabled={!selectedEmployee}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap shrink-0"
                    >
                        Apply Monthly Matrix
                    </button>
                </div>

                {/* Matrix Actions Sticky Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)] mb-6 sticky top-0 z-40 backdrop-blur-lg shadow-xl">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadMatrix}
                            disabled={!selectedEmployee || loadingMatrix}
                            className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-all text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {loadingMatrix ? 'Loading...' : <>🔄 Reload Matrix</>}
                        </button>
                        <button
                            onClick={applyBasicPattern}
                            disabled={!selectedEmployee}
                            className="px-4 py-2 bg-sky-600/10 hover:bg-sky-600/20 text-sky-400 rounded-lg border border-sky-500/20 transition-all text-sm font-bold disabled:opacity-50"
                        >
                            ⚡ Apply Standard Hours
                        </button>
                    </div>

                    <button
                        onClick={saveMatrix}
                        disabled={!selectedEmployee || savingMatrix}
                        className="w-full sm:w-auto px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xl shadow-emerald-600/20 transition-all text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {savingMatrix ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : '💾 Commit Changes to DB'}
                    </button>
                </div>

                <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-280px)] custom-scrollbar">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-[var(--bg-input)] sticky top-0 z-30 border-b-2 border-[var(--border-main)] shadow-md">
                                <tr>
                                    <th className="px-5 py-4 w-32 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-r border-[var(--border-main)] text-center">Date</th>
                                    <th className="px-4 py-4 w-20 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-r border-[var(--border-main)] text-center">Day</th>
                                    <th className="px-4 py-4 w-32 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-r border-[var(--border-main)] text-center">In Time</th>
                                    <th className="px-4 py-4 w-32 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-r border-[var(--border-main)] text-center">Out Time</th>
                                    <th className="px-4 py-4 w-32 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-r border-[var(--border-main)] text-center">Shift</th>
                                    <th className="px-4 py-4 w-24 text-xs font-bold uppercase tracking-widest text-indigo-500 border-r border-[var(--border-main)] text-center bg-indigo-500/5">Normal</th>
                                    <th className="px-4 py-4 w-24 text-xs font-bold uppercase tracking-widest text-amber-500 border-r border-[var(--border-main)] text-center bg-indigo-500/5">OT 1.5x</th>
                                    <th className="px-4 py-4 w-24 text-xs font-bold uppercase tracking-widest text-orange-500 border-r border-[var(--border-main)] text-center">OT 2.0x</th>
                                    <th className="px-4 py-4 w-24 text-xs font-bold uppercase tracking-widest text-rose-500 border-r border-[var(--border-main)] text-center bg-rose-500/5">PH Hrs</th>
                                    <th className="px-4 py-4 w-28 text-xs font-bold uppercase tracking-widest text-emerald-500 border-r border-[var(--border-main)] text-center bg-emerald-500/5">Perf. Credit</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Manual Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {matrixData.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-6 py-20 text-center text-slate-500 italic">
                                            {selectedEmployee ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                                    Building monthly matrix grid...
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-3">
                                                    <span className="text-4xl opacity-20">👤</span>
                                                    <span>Select an employee above to start manual override</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    matrixData.map((row, idx) => {
                                        const isWeekend = row.dayOfWeek === 0 || row.dayOfWeek === 6;
                                        const holiday = holidays.find(h => h.date === row.date);
                                        const isHoliday = !!holiday;

                                        return (
                                            <tr key={idx} className={`group hover:bg-white/[0.03] transition-colors ${isHoliday ? 'bg-amber-500/10' : (isWeekend ? 'bg-indigo-500/[0.03]' : '')}`}>
                                                <td className="px-5 py-3 text-xs font-mono text-[var(--text-secondary)] border-r border-[var(--border-main)] whitespace-nowrap text-center">
                                                    {isHoliday && <div className="text-[9px] text-amber-500 font-bold uppercase mb-1">{holiday.name}</div>}
                                                    {row.date.split('-').reverse().join('-')}
                                                </td>
                                                <td className={`px-4 py-3 text-xs font-bold border-r border-[var(--border-main)] text-center ${isHoliday ? 'text-amber-500' : (isWeekend ? 'text-indigo-500' : 'text-[var(--text-main)]')}`}>
                                                    {formatDay(row.date)}
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)]">
                                                    <input
                                                        type="text"
                                                        placeholder="HHmm"
                                                        value={row.in_time}
                                                        onChange={e => handleMatrixChange(idx, 'in_time', e.target.value)}
                                                        className="w-20 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-2 py-1.5 text-center text-xs text-[var(--text-main)] focus:border-indigo-500 outline-none"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)]">
                                                    <input
                                                        type="text"
                                                        placeholder="HHmm"
                                                        value={row.out_time}
                                                        onChange={e => handleMatrixChange(idx, 'out_time', e.target.value)}
                                                        className="w-20 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-2 py-1.5 text-center text-xs text-[var(--text-main)] focus:border-indigo-500 outline-none"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)]">
                                                    <select
                                                        value={row.shift}
                                                        onChange={e => handleMatrixChange(idx, 'shift', e.target.value)}
                                                        className="bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-main)] focus:border-indigo-500 outline-none cursor-pointer"
                                                    >
                                                        <option value="" className="bg-[var(--bg-input)]">Off</option>
                                                        <option value="Day" className="bg-[var(--bg-input)]">Day</option>
                                                        <option value="Night" className="bg-[var(--bg-input)]">Night</option>
                                                        <option value="Split" className="bg-[var(--bg-input)]">Split</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)] bg-indigo-500/5">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={row.normal_hours}
                                                        onChange={e => handleMatrixChange(idx, 'normal_hours', e.target.value)}
                                                        className="w-16 bg-[var(--bg-input)] border border-indigo-500/20 rounded-lg px-1 py-1.5 text-center text-indigo-500 text-xs font-mono outline-none focus:border-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)] bg-indigo-500/5">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={row.ot_1_5_hours}
                                                        onChange={e => handleMatrixChange(idx, 'ot_1_5_hours', e.target.value)}
                                                        className="w-16 bg-[var(--bg-input)] border border-amber-500/20 rounded-lg px-1 py-1.5 text-center text-amber-500 text-xs font-mono font-bold outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)]">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={row.ot_2_0_hours}
                                                        onChange={e => handleMatrixChange(idx, 'ot_2_0_hours', e.target.value)}
                                                        className="w-16 bg-[var(--bg-input)] border border-orange-500/20 rounded-lg px-1 py-1.5 text-center text-orange-500 text-xs font-mono font-bold outline-none focus:border-orange-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)] bg-rose-500/5">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={row.ph_hours}
                                                        onChange={e => handleMatrixChange(idx, 'ph_hours', e.target.value)}
                                                        className="w-16 bg-[var(--bg-input)] border border-rose-500/20 rounded-lg px-1 py-1.5 text-center text-rose-500 text-xs font-mono font-bold outline-none focus:border-rose-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-[var(--border-main)] bg-emerald-500/5">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={row.performance_credit}
                                                        onChange={e => handleMatrixChange(idx, 'performance_credit', e.target.value)}
                                                        className="w-16 bg-[var(--bg-input)] border border-emerald-500/20 rounded-lg px-1 py-1.5 text-center text-emerald-500 text-xs font-mono outline-none focus:border-emerald-500"
                                                    />
                                                </td>
                                                <td className="px-6 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Notes..."
                                                        value={row.remarks}
                                                        onChange={e => handleMatrixChange(idx, 'remarks', e.target.value)}
                                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-2 py-1.5 text-[var(--text-main)] text-xs focus:text-indigo-500 outline-none focus:border-indigo-500 transition-all"
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            {matrixData.length > 0 && (
                                <tfoot className="bg-[var(--bg-card)] sticky bottom-0 z-10 border-t-2 border-[var(--border-main)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                    <tr className="uppercase tracking-widest text-[10px] font-bold">
                                        <td colSpan={5} className="px-6 py-4 text-right text-[var(--text-muted)]">Totals for {new Date(2000, selectedMonth - 1).toLocaleString('default', { month: 'long' })}:</td>
                                        <td className="px-4 py-4 text-center border-l border-[var(--border-main)] bg-indigo-500/10 text-indigo-500 text-sm font-mono">
                                            {matrixData.reduce((sum, r) => sum + (parseFloat(r.normal_hours) || 0), 0).toFixed(1)}
                                        </td>
                                        <td className="px-4 py-4 text-center border-l border-[var(--border-main)] bg-amber-500/10 text-amber-500 text-sm font-mono">
                                            {matrixData.reduce((sum, r) => sum + (parseFloat(r.ot_1_5_hours) || 0), 0).toFixed(1)}
                                        </td>
                                        <td className="px-4 py-4 text-center border-l border-[var(--border-main)] text-orange-500 text-sm font-mono bg-orange-500/5">
                                            {matrixData.reduce((sum, r) => sum + (parseFloat(r.ot_2_0_hours) || 0), 0).toFixed(1)}
                                        </td>
                                        <td className="px-4 py-4 text-center border-l border-[var(--border-main)] bg-rose-500/10 text-rose-500 text-sm font-mono">
                                            {matrixData.reduce((sum, r) => sum + (parseFloat(r.ph_hours) || 0), 0).toFixed(1)}
                                        </td>
                                        <td className="px-4 py-4 text-center border-l border-[var(--border-main)] bg-emerald-500/10 text-emerald-500 text-sm font-mono">
                                            {matrixData.reduce((sum, r) => sum + (parseFloat(r.performance_credit) || 0), 0).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 border-l border-[var(--border-main)]"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div >
    )
}
