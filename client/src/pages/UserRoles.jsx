import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

const emptyRole = {
    name: '', description: '', permissions: []
}

export default function UserRoles() {
    const { role: currentRole } = useAuth()
    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(emptyRole)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)

    const load = () => {
        setLoading(true)
        api.getUserRoles()
            .then(setRoles)
            .catch(e => toast.error('Failed to load roles: ' + e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        load()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) {
                await api.updateUserRole(editing.id, form)
                toast.success('Role updated')
            } else {
                await api.createUserRole(form)
                toast.success('Role created')
            }
            setShowModal(false)
            setEditing(null)
            setForm(emptyRole)
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleEdit = (r) => {
        setEditing({ ...r })
        setForm({ ...r })
        setShowModal(true)
    }

    const confirmDelete = (r) => {
        if (['Admin', 'HR'].includes(r.name)) {
            toast.error('Cannot delete core system roles')
            return
        }
        setItemToDelete(r)
        setShowDeleteModal(true)
    }

    const handleDelete = async () => {
        try {
            await api.deleteUserRole(itemToDelete.id)
            toast.success('Role deleted')
            setShowDeleteModal(false)
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    if (currentRole !== 'Admin') return null

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">User Roles</h1>
                    <p className="text-slate-400 mt-1">Define system access levels and permissions.</p>
                </div>
                <button onClick={() => { setEditing(null); setForm(emptyRole); setShowModal(true) }} className="gradient-btn">+ Create Role</button>
            </div>

            <div className="glass-card overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <div className="overflow-x-auto">
                        <table className="table-glass">
                            <thead>
                                <tr>
                                    <th>Role Name</th>
                                    <th>Description</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.map(r => (
                                    <tr key={r.id}>
                                        <td className="font-bold text-white">{r.name}</td>
                                        <td className="text-slate-300">{r.description}</td>
                                        <td className="text-slate-400 text-sm">{new Date(r.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(r)} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">✏️ Edit</button>
                                                {!['Admin', 'HR'].includes(r.name) && (
                                                    <button onClick={() => confirmDelete(r)} className="text-xs text-red-400 hover:text-red-300 transition-colors">🗑️ Delete</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">{editing ? 'Edit Role' : 'Create New Role'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role Name</label>
                                <input required type="text" className="input-glass w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={editing && ['Admin', 'HR'].includes(editing.name)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea className="input-glass w-full" rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">{editing ? 'Save Changes' : 'Create Role'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <DeleteConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDelete}
                    itemName={itemToDelete?.name}
                />
            )}
        </div>
    )
}
