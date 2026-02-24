import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function Entities() {
    const { role, setEntities, activeEntity, switchEntity } = useAuth()
    const [loading, setLoading] = useState(false)
    const [localEntities, setLocalEntities] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', uen: '', address: '', contact_number: '', website: '', email_domains: '' })

    const canEdit = role === 'Admin'

    const loadData = async () => {
        setLoading(true)
        try {
            const data = await api.getEntities()
            setLocalEntities(data)
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
        setForm({ name: '', uen: '', address: '', contact_number: '', website: '', email_domains: '' })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) {
                await api.updateEntity(editing.id, form)
                // Update global context if the active entity was edited
                if (activeEntity && activeEntity.id === editing.id) {
                    const updatedEntity = { ...activeEntity, ...form };
                    switchEntity(updatedEntity);
                }
            } else {
                await api.createEntity(form)
            }

            toast.success('Entity saved')
            setShowModal(false)

            // Refresh global entities list
            const allEntities = await api.getEntities();
            setEntities(allEntities);

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Business Entities</h1>
                    <p className="text-[var(--text-muted)] mt-1">Manage physical business divisions and UENs.</p>
                </div>
                {canEdit && (
                    <button onClick={handleAdd} className="btn-primary w-full sm:w-auto">+ Add Entity</button>
                )}
            </div>

            <div className="card-base overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <table className="table-theme w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>UEN</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localEntities.map(item => (
                                <tr key={item.id}>
                                    <td className="font-medium text-[var(--text-main)]">{item.name}</td>
                                    <td>{item.uen}</td>
                                    <td>
                                        {canEdit && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="text-xs text-[var(--brand-primary)] hover:text-cyan-300 transition-colors">✏️ Edit</button>
                                                <button onClick={() => confirmDelete(item)} className="text-xs text-red-400 hover:text-red-300 transition-colors" id={`delete-btn-${item.id}`}>🗑️ Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {localEntities.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-[var(--text-muted)]">No entities found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card-base p-6 w-full max-w-2xl animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-6">{editing ? 'Edit' : 'Add'} Entity</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Entity Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.name || ''}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="input-base w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Company UEN</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.uen || ''}
                                        onChange={e => setForm({ ...form, uen: e.target.value })}
                                        className="input-base w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Contact Number</label>
                                    <input
                                        type="text"
                                        value={form.contact_number || ''}
                                        onChange={e => setForm({ ...form, contact_number: e.target.value })}
                                        className="input-base w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Website</label>
                                    <input
                                        type="url"
                                        value={form.website || ''}
                                        onChange={e => setForm({ ...form, website: e.target.value })}
                                        className="input-base w-full"
                                        placeholder="https://"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Address</label>
                                    <textarea
                                        value={form.address || ''}
                                        onChange={e => setForm({ ...form, address: e.target.value })}
                                        className="input-base w-full min-h-[60px]"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Email Domains (comma separated)</label>
                                    <input
                                        type="text"
                                        value={form.email_domains || ''}
                                        onChange={e => setForm({ ...form, email_domains: e.target.value })}
                                        className="input-base w-full"
                                        placeholder="gmail.com, company.com"
                                    />
                                    <p className="text-[10px] text-[var(--text-muted)] mt-1">These domains will be suggested in the Employee form.</p>
                                </div>
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
