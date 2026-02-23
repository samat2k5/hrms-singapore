import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function EmployeeGrades() {
    const { role, activeEntity } = useAuth()
    const [loading, setLoading] = useState(false)
    const [grades, setGrades] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [form, setForm] = useState({ name: '', description: '' })

    const loadData = async () => {
        setLoading(true)
        try {
            const data = await api.getEmployeeGrades()
            setGrades(data)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [activeEntity])

    const handleAdd = () => {
        setForm({ name: '', description: '' })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await api.createEmployeeGrade(form)
            toast.success('Employee Grade saved')
            setShowModal(false)
            loadData()
        } catch (err) { toast.error(err.message) }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return
        try {
            await api.deleteEmployeeGrade(itemToDelete.id)
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
                    <h1 className="text-3xl font-bold text-white">Employee Grades</h1>
                    <p className="text-slate-400 mt-1">Manage corporate grading structure for {activeEntity?.name || 'this entity'}.</p>
                </div>
                {canEditConfigs && (
                    <button onClick={handleAdd} className="gradient-btn">+ Add Grade</button>
                )}
            </div>

            <div className="glass-card overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <table className="table-glass w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grades.map(item => (
                                <tr key={item.id}>
                                    <td className="font-medium text-white">{item.name}</td>
                                    <td className="text-slate-400 truncate max-w-xs">{item.description || '-'}</td>
                                    <td>
                                        {canEditConfigs && (
                                            <div className="flex gap-2">
                                                <button onClick={() => confirmDelete(item)} className="text-xs text-red-400 hover:text-red-300 transition-colors">🗑️ Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {grades.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-slate-500">No employee grades found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Add Employee Grade</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Grade Name (e.g., A1, Executive, Staff)</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name || ''}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="input-glass w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description (Optional)</label>
                                <textarea
                                    value={form.description || ''}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="input-glass w-full min-h-[80px]"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <DeleteConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                itemName={itemToDelete?.name}
            />
        </div>
    )
}
