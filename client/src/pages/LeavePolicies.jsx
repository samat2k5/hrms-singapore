import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function LeavePolicies() {
    const { role, activeEntity } = useAuth()
    const [loading, setLoading] = useState(false)
    const [policies, setPolicies] = useState([])
    const [grades, setGrades] = useState([])
    const [leaveTypes, setLeaveTypes] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [form, setForm] = useState({ employee_grade: '', leave_type_id: '', base_days: 0, increment_per_year: 0, max_days: 0 })

    const loadData = async () => {
        setLoading(true)
        try {
            const [p, g, lt] = await Promise.all([
                api.getLeavePolicies(),
                api.getEmployeeGrades(),
                api.getLeaveTypes()
            ])
            setPolicies(p)
            setGrades(g)
            setLeaveTypes(lt)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [activeEntity])

    const handleAdd = () => {
        setForm({ employee_grade: '', leave_type_id: '', base_days: 0, increment_per_year: 0, max_days: 0 })
        setShowModal(true)
    }

    const handleEdit = (item) => {
        setForm({
            employee_grade: item.employee_grade,
            leave_type_id: item.leave_type_id,
            base_days: item.base_days,
            increment_per_year: item.increment_per_year,
            max_days: item.max_days
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await api.saveLeavePolicy(form)
            toast.success('Leave Policy saved')
            setShowModal(false)
            loadData()
        } catch (err) { toast.error(err.message) }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return
        try {
            await api.deleteLeavePolicy(itemToDelete.id)
            toast.success('Deleted successfully')
            setShowDeleteModal(false)
            setItemToDelete(null)
            loadData()
        } catch (err) { toast.error(err.message) }
    }

    const confirmDelete = (item) => {
        setItemToDelete(item)
        setShowDeleteModal(true)
    }

    const canEditConfigs = ['Admin', 'HR'].includes(role)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Leave Policies</h1>
                    <p className="text-slate-400 mt-1">Configure grade-wise entitlement and increments for {activeEntity?.name || 'this entity'}.</p>
                </div>
                {canEditConfigs && (
                    <button onClick={handleAdd} className="gradient-btn">+ Configure Policy</button>
                )}
            </div>

            <div className="glass-card overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <table className="table-glass w-full">
                        <thead>
                            <tr>
                                <th>Grade</th>
                                <th>Leave Type</th>
                                <th>Base Days</th>
                                <th>Increment/Year</th>
                                <th>Max Cap</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {policies.map(item => (
                                <tr key={item.id}>
                                    <td className="font-medium text-white">{item.employee_grade}</td>
                                    <td>{item.leave_type_name}</td>
                                    <td>{item.base_days}</td>
                                    <td>{item.increment_per_year}</td>
                                    <td>{item.max_days}</td>
                                    <td>
                                        {canEditConfigs && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">✏️ Edit</button>
                                                <button onClick={() => confirmDelete(item)} className="text-xs text-red-400 hover:text-red-300 transition-colors">🗑️ Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {policies.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-slate-500">No leave policies mapped.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Leave Policy Settings</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Employee Grade</label>
                                <select
                                    value={form.employee_grade}
                                    onChange={e => setForm({ ...form, employee_grade: e.target.value })}
                                    className="select-glass w-full" required>
                                    <option value="">Select Grade</option>
                                    {grades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Leave Type</label>
                                <select
                                    value={form.leave_type_id}
                                    onChange={e => setForm({ ...form, leave_type_id: parseInt(e.target.value) })}
                                    className="select-glass w-full" required>
                                    <option value="">Select Type</option>
                                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Base Days</label>
                                    <input type="number" step="0.5" min="0" required value={form.base_days} onChange={e => setForm({ ...form, base_days: parseFloat(e.target.value) || 0 })} className="input-glass w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Yearly Increment</label>
                                    <input type="number" step="0.5" min="0" required value={form.increment_per_year} onChange={e => setForm({ ...form, increment_per_year: parseFloat(e.target.value) || 0 })} className="input-glass w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Max Cap Days</label>
                                    <input type="number" step="0.5" min="0" required value={form.max_days} onChange={e => setForm({ ...form, max_days: parseFloat(e.target.value) || 0 })} className="input-glass w-full" />
                                </div>
                            </div>

                            <p className="text-xs text-amber-400 mt-2">
                                Note: MoM statutory minimums are actively enforced. The highest entitlement between your explicit policy and MoM's mapping will be automatically executed.
                            </p>

                            <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">Save Policy</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <DeleteConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                itemName={`Policy rule`}
            />
        </div>
    )
}
