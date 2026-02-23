import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function Entities() {
    const { role } = useAuth()
    const [loading, setLoading] = useState(false)
    const [entities, setEntities] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', uen: '' })

    const canEdit = role === 'Admin'

    const loadData = async () => {
        setLoading(true)
        try {
            const data = await api.getEntities()
            setEntities(data)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleEdit = (item) => {
        setEditing(item)
        setForm({ ...item })
        setShowModal(true)
    }

    const handleAdd = () => {
        setEditing(null)
        setForm({ name: '', uen: '' })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) await api.updateEntity(editing.id, form)
            else await api.createEntity(form)

            toast.success('Entity saved')
            setShowModal(false)
            loadData()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return
        try {
            await api.deleteEntity(itemToDelete.id)
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Business Entities</h1>
                    <p className="text-slate-400 mt-1">Manage physical business divisions and UENs.</p>
                </div>
                {canEdit && (
                    <button onClick={handleAdd} className="gradient-btn">+ Add Entity</button>
                )}
            </div>

            <div className="glass-card overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <table className="table-glass w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>UEN</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entities.map(item => (
                                <tr key={item.id}>
                                    <td className="font-medium text-white">{item.name}</td>
                                    <td>{item.uen}</td>
                                    <td>
                                        {canEdit && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">✏️ Edit</button>
                                                <button onClick={() => confirmDelete(item)} className="text-xs text-red-400 hover:text-red-300 transition-colors" id={`delete-btn-${item.id}`}>🗑️ Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {entities.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-slate-500">No entities found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <h2 className="text-xl font-bold text-white mb-6">{editing ? 'Edit' : 'Add'} Entity</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Entity Name</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name || ''}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="input-glass w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Company UEN</label>
                                <input
                                    type="text"
                                    required
                                    value={form.uen || ''}
                                    onChange={e => setForm({ ...form, uen: e.target.value })}
                                    className="input-glass w-full"
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
