import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function Holidays() {
    const { role, activeEntity } = useAuth()
    const [loading, setLoading] = useState(false)
    const [holidays, setHolidays] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', date: '', description: '' })

    const loadData = async () => {
        setLoading(true)
        try {
            const data = await api.getHolidays()
            setHolidays(data)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [activeEntity])

    const handleEdit = (item) => {
        setEditing(item)
        setForm({ ...item })
        setShowModal(true)
    }

    const handleAdd = () => {
        setEditing(null)
        setForm({ name: '', date: '', description: '' })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) await api.updateHoliday(editing.id, form)
            else await api.createHoliday(form)

            toast.success('Holiday saved')
            setShowModal(false)
            loadData()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return
        try {
            await api.deleteHoliday(itemToDelete.id)
            toast.success('Deleted successfully')
            setShowDeleteModal(false)
            setItemToDelete(null)
            loadData()
        } catch (err) {
            toast.error(err.message)
        }
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
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Holiday Master</h1>
                    <p className="text-[var(--text-muted)] mt-1">Manage public and customary holidays for {activeEntity?.name || 'this entity'}.</p>
                </div>
                {canEditConfigs && (
                    <button onClick={handleAdd} className="btn-primary">+ Add Holiday</button>
                )}
            </div>

            <div className="card-base overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <table className="table-theme w-full">
                        <thead>
                            <tr>
                                <th>Holiday Title</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holidays.map(item => (
                                <tr key={item.id}>
                                    <td className="font-medium text-[var(--text-main)]">{item.name}</td>
                                    <td className="text-[var(--brand-primary)]">{item.date}</td>
                                    <td className="text-[var(--text-muted)] truncate max-w-xs">{item.description || '-'}</td>
                                    <td>
                                        {canEditConfigs && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="text-xs text-[var(--brand-primary)] hover:text-cyan-300 transition-colors">✏️ Edit</button>
                                                <button onClick={() => confirmDelete(item)} className="text-xs text-red-400 hover:text-red-300 transition-colors" id={`delete-btn-${item.id}`}>🗑️ Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {holidays.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-[var(--text-muted)]">No holidays found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card-base p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-6">{editing ? 'Edit' : 'Add'} Holiday</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Holiday Title</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name || ''}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="input-base w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={form.date || ''}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="input-base w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Description (Optional)</label>
                                <textarea
                                    value={form.description || ''}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="input-base w-full min-h-[80px]"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-[var(--border-main)] mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save</button>
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
