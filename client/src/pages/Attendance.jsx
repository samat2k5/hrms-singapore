import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Attendance() {
    const { activeEntity } = useAuth()
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [history, setHistory] = useState([])
    const [stats, setStats] = useState(null)

    const loadHistory = async () => {
        try {
            const data = await api.getAttendanceHistory()
            setHistory(data)
        } catch (err) {
            toast.error('Failed to load history')
        }
    }

    useEffect(() => {
        if (activeEntity) loadHistory()
    }, [activeEntity])

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

        try {
            const res = await api.importAttendance(formData)
            toast.success('Attendance imported successfully')
            setStats(res.results)
            setFile(null)
            loadHistory()
        } catch (err) {
            toast.error(err.message || 'Import failed')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-white">Time Attendance Import</h1>
                    <p className="text-gray-400">Upload daily site reports to sync OT and leaves</p>
                </div>
                <a
                    href="/Attendance_Template.xlsx"
                    download
                    className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                >
                    <span className="text-lg">📥</span>
                    Download Template
                </a>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Zone */}
                <div className="lg:col-span-1 bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-xl space-y-4 h-fit">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span className="text-xl">☁️</span>
                        Import Excel
                    </h2>

                    <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".xlsx"
                        />
                        <div className="space-y-2">
                            <span className="text-4xl block">📤</span>
                            <p className="text-sm text-gray-300">
                                {file ? file.name : 'Click to select or drag and drop'}
                            </p>
                            <p className="text-xs text-gray-500">Site Attendance Excel (.xlsx)</p>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                    >
                        {uploading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : 'Start Import'}
                    </button>

                    {stats && (
                        <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/5 text-sm">
                            <h3 className="text-indigo-400 font-semibold mb-2">Last Import Results:</h3>
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

                {/* History Table */}
                <div className="lg:col-span-2 bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-xl overflow-hidden">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        Recent Attendance Data
                    </h2>

                    <div className="overflow-x-auto h-[500px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3 text-center">In/Out</th>
                                    <th className="px-4 py-3 text-center">OT</th>
                                    <th className="px-4 py-3">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {history.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 text-gray-300 text-sm">
                                        <td className="px-4 py-3 whitespace-nowrap">{row.date}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-white">{row.employee_name}</div>
                                            <div className="text-xs text-gray-500">{row.employee_code}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {row.in_time} - {row.out_time}
                                            <span className="ml-2 px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400">{row.shift}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-indigo-400">
                                            {row.ot_hours > 0 ? `${row.ot_hours}h` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 italic max-w-xs truncate">
                                            {row.remarks}
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                            No attendance data found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
