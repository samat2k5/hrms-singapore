import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

const emptyUser = {
    username: '', full_name: '', password: '', role: 'HR', managed_groups: [], entityIds: []
}

export default function Users() {
    const { user: currentUser, role } = useAuth()
    const navigate = useNavigate()

    const [users, setUsers] = useState([])
    const [employeeGroups, setEmployeeGroups] = useState([])
    const [allEntities, setAllEntities] = useState([])
    const [allRoles, setAllRoles] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(emptyUser)

    const load = async () => {
        setLoading(true)
        try {
            const [uData, gData, rData, eData] = await Promise.all([
                api.getUsers(),
                api.getEmployeeGroups(),
                api.getUserRoles(),
                api.getEntities()
            ])
            setUsers(uData)
            setEmployeeGroups(gData)
            setAllRoles(rData)
            setAllEntities(eData)
        } catch (e) {
            toast.error('Failed to load data: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (role && role !== 'Admin') {
            toast.error('Unauthorized access');
            navigate('/');
            return;
        }
        if (role === 'Admin') {
            load()
        }
    }, [role, navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) {
                await api.updateUser(editing.id, form)
                toast.success('User updated')
            } else {
                await api.createUser(form)
                toast.success('User created')
            }
            setShowModal(false)
            setEditing(null)
            setForm(emptyUser)
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleEdit = (u) => {
        setEditing({ ...u })
        setForm({ ...u, password: '' }) // Never load the existing password into form
        setShowModal(true)
    }

    const confirmDelete = (u) => {
        setItemToDelete(u)
        setShowDeleteModal(true)
    }

    const handleDelete = async () => {
        if (!itemToDelete) return
        try {
            await api.deleteUser(itemToDelete.id)
            toast.success('User deleted')
            setShowDeleteModal(false)
            setItemToDelete(null)
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const toggleGroup = (group) => {
        const groups = form.managed_groups || [];
        if (groups.includes(group)) {
            setForm({ ...form, managed_groups: groups.filter(g => g !== group) });
        } else {
            setForm({ ...form, managed_groups: [...groups, group] });
        }
    }

    if (role !== 'Admin') return null;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">System Users</h1>
                    <p className="text-slate-400 mt-1">Manage administrators, HR managers, and access groups.</p>
                </div>
                <button onClick={() => { setEditing(null); setForm(emptyUser); setShowModal(true) }} className="gradient-btn">+ Assign User</button>
            </div>

            <div className="glass-card overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <div className="overflow-x-auto">
                        <table className="table-glass">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Full Name</th>
                                    <th>Role</th>
                                    <th>Managed Groups</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td className="font-medium text-white">{u.username}</td>
                                        <td>{u.full_name}</td>
                                        <td>
                                            <span className={`badge border ${u.role === 'Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                {u.role === 'Admin' ? (
                                                    <span className="text-xs text-slate-500 italic">All Groups</span>
                                                ) : (
                                                    u.managed_groups?.map(g => (
                                                        <span key={g} className="badge-neutral text-[10px]">{g}</span>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-slate-400 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(u)} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors" title="Edit">✏️</button>
                                                <button onClick={() => confirmDelete(u)} className="text-xs text-red-400 hover:text-red-300 transition-colors" title="Delete">🗑️</button>
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
                            <h2 className="text-xl font-bold text-white">{editing ? 'Edit User' : 'Add New User'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                                <input required type="text" className="input-glass w-full" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!editing} />
                            </div>

                            {!editing && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                                    <input required={!editing} type="password" className="input-glass w-full" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                                <input required type="text" className="input-glass w-full" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                                <select className="select-glass w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                    {allRoles.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            {!editing && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2 mt-2">Assign to Entities</label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                        {allEntities.map(ent => (
                                            <label key={ent.id} className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-all text-sm">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-white/10 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                                                    checked={form.entityIds?.includes(ent.id)}
                                                    onChange={e => {
                                                        const ids = form.entityIds || [];
                                                        if (e.target.checked) setForm({ ...form, entityIds: [...ids, ent.id] });
                                                        else setForm({ ...form, entityIds: ids.filter(id => id !== ent.id) });
                                                    }}
                                                />
                                                <span className="text-slate-200">{ent.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">The user will be given the same role across all selected entities.</p>
                                </div>
                            )}

                            {form.role !== 'Admin' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2 mt-2">Managed Employee Groups</label>
                                    <div className="flex flex-wrap gap-2">
                                        {employeeGroups.length > 0 ? (
                                            employeeGroups.map(group => {
                                                const isActive = form.managed_groups?.includes(group.name);
                                                return (
                                                    <button
                                                        key={group.id}
                                                        type="button"
                                                        onClick={() => toggleGroup(group.name)}
                                                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${isActive ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800'}`}
                                                    >
                                                        {group.name}
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <p className="text-xs text-slate-500 italic">No employee groups found. Create groups in Master Data first.</p>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Select the employee groups this HR user is allowed to view and manage payroll for.</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">{editing ? 'Save Changes' : 'Create User'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <DeleteConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                itemName={itemToDelete?.username}
                title="Delete User?"
            />
        </div>
    )
}
