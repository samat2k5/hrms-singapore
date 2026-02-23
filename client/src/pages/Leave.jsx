import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatDate } from '../utils/formatters'

export default function Leave() {
    const [tab, setTab] = useState('balances')
    const [employees, setEmployees] = useState([])
    const [leaveTypes, setLeaveTypes] = useState([])
    const [balances, setBalances] = useState([])
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [showApply, setShowApply] = useState(false)
    const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: 1, reason: '' })
    const year = new Date().getFullYear()

    const load = async () => {
        try {
            const [emps, types, bals, reqs] = await Promise.all([
                api.getEmployees(), api.getLeaveTypes(), api.getAllLeaveBalances(year), api.getLeaveRequests()
            ])
            setEmployees(emps.filter(e => e.status === 'Active'))
            setLeaveTypes(types)
            setBalances(bals)
            setRequests(reqs)
        } catch (e) { toast.error(e.message) }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleApply = async (e) => {
        e.preventDefault()
        try {
            await api.submitLeaveRequest(form)
            toast.success('Leave request submitted')
            setShowApply(false)
            setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: 1, reason: '' })
            load()
        } catch (err) { toast.error(err.message) }
    }

    const handleAction = async (id, action) => {
        try {
            if (action === 'approve') await api.approveLeave(id)
            else await api.rejectLeave(id)
            toast.success(`Leave ${action}d`)
            load()
        } catch (err) { toast.error(err.message) }
    }

    // Group balances by employee
    const byEmployee = {}
    balances.forEach(b => {
        if (!byEmployee[b.employee_id]) byEmployee[b.employee_id] = { name: b.employee_name, code: b.employee_code, leaves: [] }
        byEmployee[b.employee_id].leaves.push(b)
    })

    if (loading) return <div className="glass-card h-96 loading-shimmer" />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Leave Management</h1>
                    <p className="text-slate-400 mt-1">Track balances and manage requests</p>
                </div>
                <button onClick={() => setShowApply(true)} className="gradient-btn">+ Apply Leave</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {['balances', 'requests'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                        {t === 'balances' ? '📊 Leave Balances' : '📝 Leave Requests'}
                    </button>
                ))}
            </div>

            {/* Balances Tab */}
            {tab === 'balances' && (
                <div className="grid gap-4">
                    {Object.entries(byEmployee).map(([empId, data]) => (
                        <div key={empId} className="glass-card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-white">{data.name}</h3>
                                    <p className="text-xs text-slate-500">{data.code}</p>
                                </div>
                                <span className="text-xs text-slate-500">{year}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {data.leaves.map(l => {
                                    if (l.entitled === 0 && l.leave_type_name === 'Unpaid Leave') return null
                                    const pct = l.entitled > 0 ? (l.taken / l.entitled) * 100 : 0
                                    return (
                                        <div key={l.id} className="p-3 rounded-xl bg-white/3 border border-white/5">
                                            <p className="text-xs text-slate-400 mb-1 truncate">{l.leave_type_name}</p>
                                            <div className="flex items-end justify-between mb-2">
                                                <span className="text-lg font-bold text-white">{l.balance}</span>
                                                <span className="text-xs text-slate-500">/ {l.entitled}</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-white/5">
                                                <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(pct, 100)}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Requests Tab */}
            {tab === 'requests' && (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table-glass">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Leave Type</th>
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Days</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(r => (
                                    <tr key={r.id}>
                                        <td className="font-medium text-white">{r.employee_name}</td>
                                        <td>{r.leave_type_name}</td>
                                        <td>{formatDate(r.start_date)}</td>
                                        <td>{formatDate(r.end_date)}</td>
                                        <td>{r.days}</td>
                                        <td className="max-w-[200px] truncate">{r.reason || '—'}</td>
                                        <td>
                                            <span className={r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>
                                            {r.status === 'Pending' && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAction(r.id, 'approve')} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">✓</button>
                                                    <button onClick={() => handleAction(r.id, 'reject')} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">✕</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {requests.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-slate-500">No leave requests</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Apply Modal */}
            {showApply && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-6 w-full max-w-lg animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Apply Leave</h2>
                            <button onClick={() => setShowApply(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleApply} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-300 mb-1.5">Employee</label>
                                <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: parseInt(e.target.value) })} className="select-glass" required>
                                    <option value="">Select employee</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1.5">Leave Type</label>
                                <select value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: parseInt(e.target.value) })} className="select-glass" required>
                                    <option value="">Select type</option>
                                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-300 mb-1.5">Start Date</label>
                                    <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="input-glass" required />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-300 mb-1.5">End Date</label>
                                    <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="input-glass" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1.5">Days</label>
                                <input type="number" value={form.days} onChange={e => setForm({ ...form, days: parseFloat(e.target.value) || 0 })} className="input-glass" min="0.5" step="0.5" required />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1.5">Reason</label>
                                <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-glass" placeholder="Optional" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowApply(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
