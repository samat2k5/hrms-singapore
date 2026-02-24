import { useState } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'

export default function BulkImportModal({ isOpen, onClose, onRefresh }) {
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState(null)

    if (!isOpen) return null

    const handleDownloadTemplate = () => {
        const headers = [
            'Employee ID', 'Full Name', 'National ID', 'Nationality', 'Gender',
            'Date of Birth', 'Date Joined', 'Designation', 'Group', 'Basic Salary',
            'Email', 'Mobile', 'Bank Name', 'Bank Account'
        ]
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" +
            "EMP001,John Doe,S1234567A,Citizen,Male,1990-01-01,2024-01-01,Manager,General,5000,john@example.com,91234567,DBS,123-45678-9";

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "employee_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleUpload = async (e) => {
        e.preventDefault()
        if (!file) return toast.error('Please select a file')

        setLoading(true)
        setResults(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await api.importEmployees(formData)
            setResults(res)
            toast.success('Import completed')
            if (onRefresh) onRefresh()
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-[var(--text-main)]">
            <div className="card-base w-full max-w-lg overflow-hidden border border-[var(--border-main)] shadow-2xl animate-scale-up">
                <div className="p-6 border-b border-[var(--border-main)] bg-gradient-to-r from-blue-600/20 to-cyan-600/20">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">📥</span> Bulk Import Employees
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-[var(--bg-input)] rounded-full transition-colors">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-4">
                        <span className="text-xl">💡</span>
                        <div className="text-sm">
                            <p className="font-bold text-blue-300 mb-1">Getting Started</p>
                            <p className="text-[var(--text-muted)]">Download the template to see the required format and example data.</p>
                            <button
                                onClick={handleDownloadTemplate}
                                className="mt-3 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-blue-500/30"
                            >
                                📥 Download Template (CSV)
                            </button>
                        </div>
                    </div>

                    {!results ? (
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-[var(--text-muted)]">Select File (XLSX or CSV)</label>
                                <div className="border-2 border-dashed border-[var(--border-main)] rounded-xl p-8 text-center hover:border-blue-500/40 transition-all bg-white/[0.02] group cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        onChange={e => setFile(e.target.files[0])}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <div className="space-y-3">
                                        <div className="text-4xl group-hover:scale-110 transition-transform duration-300">📁</div>
                                        <div>
                                            {file ? (
                                                <p className="text-blue-400 font-bold">{file.name}</p>
                                            ) : (
                                                <>
                                                    <p className="text-[var(--text-muted)] font-medium">Click to browse or drag and drop</p>
                                                    <p className="text-xs text-[var(--text-muted)]">Supports .xlsx, .xls, .csv</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-[var(--text-muted)] rounded-xl font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !file}
                                    className="flex-[2] py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-[var(--text-main)] rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-[var(--border-main)] border-t-white rounded-full animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        'Start Import'
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-center">
                                    <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Processed</p>
                                    <p className="text-2xl font-bold text-green-400">{results.processed}</p>
                                </div>
                                <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-center">
                                    <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Skipped</p>
                                    <p className="text-2xl font-bold text-orange-400">{results.skipped}</p>
                                </div>
                            </div>

                            {results.errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-2">
                                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Issues Encountered</p>
                                    <div className="max-h-32 overflow-y-auto text-xs text-[var(--text-muted)] space-y-1 custom-scrollbar">
                                        {results.errors.map((err, i) => (
                                            <p key={i} className="flex gap-2">
                                                <span className="text-red-500">•</span> {err}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-[var(--text-muted)] rounded-xl font-bold transition-all mt-4"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
