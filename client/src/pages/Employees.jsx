import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import BulkImportModal from '../components/BulkImportModal'

export default function Employees() {
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('All')

    // Transfer feature state
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transferringEmp, setTransferringEmp] = useState(null)
    const [targetEntityId, setTargetEntityId] = useState('')
    const [entities, setEntities] = useState([])
    const [showImportModal, setShowImportModal] = useState(false)

    const navigate = useNavigate()

    const load = () => {
        Promise.all([
            api.getEmployees(),
            api.getEntities()
        ])
            .then(([emps, ents]) => {
                setEmployees(emps)
                setEntities(ents)
            })
            .catch(e => toast.error(e.message))
            .finally(() => setLoading(false))
    }
    useEffect(load, [])

    const handleEdit = (emp) => {
        navigate(`/employees/edit/${emp.id}`)
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this employee? This will also remove their KETs and leave records.')) return
        try {
            await api.deleteEmployee(id)
            toast.success('Employee deleted')
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const openTransferModal = (emp) => {
        setTransferringEmp(emp)
        setTargetEntityId('')
        setShowTransferModal(true)
    }

    const handleTransfer = async (e) => {
        e.preventDefault()
        if (!targetEntityId) return toast.error('Please select a target entity.')
        try {
            await api.transferEmployee(transferringEmp.id, targetEntityId)
            toast.success(`${transferringEmp.full_name} transferred successfully.`)
            setShowTransferModal(false)
            setTransferringEmp(null)
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const filtered = employees.filter(e => {
        const matchSearch = e.full_name.toLowerCase().includes(search.toLowerCase()) ||
            e.employee_id.toLowerCase().includes(search.toLowerCase())
        const matchFilter = filter === 'All' || e.status === filter
        return matchSearch && matchFilter
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Employees</h1>
                    <p className="text-[var(--text-muted)] mt-1">{employees.length} total · {employees.filter(e => e.status === 'Active').length} active</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <button onClick={() => setShowImportModal(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--bg-input)] text-[var(--text-main)] rounded-xl font-bold transition-all border border-[var(--border-main)] flex items-center justify-center gap-2 shadow-sm">
                        📥 Bulk Import
                    </button>
                    <button onClick={() => navigate('/employees/add')} className="flex-1 sm:flex-none btn-primary">+ Add Employee</button>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input-base flex-1 max-w-full sm:max-w-md"
                />
                <select value={filter} onChange={e => setFilter(e.target.value)} className="select-base w-full sm:w-40">
                    <option>All</option>
                    <option>Active</option>
                    <option>Inactive</option>
                </select>
            </div>

            {/* Table */}
            <div className="card-base overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <div className="overflow-x-auto">
                        <table className="table-theme">
                            <thead>
                                <tr>
                                    <th>Employee ID</th>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Group</th>
                                    <th>Designation</th>
                                    <th>Basic Salary</th>
                                    <th>Nationality</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(emp => (
                                    <tr key={emp.id}>
                                        <td className="font-bold text-[var(--brand-primary)]">{emp.employee_id}</td>
                                        <td className="font-bold text-[var(--text-main)]">{emp.full_name}</td>
                                        <td>{emp.department}</td>
                                        <td>
                                            <span className="badge-neutral border border-[var(--border-main)]">{emp.employee_group || 'General'}</span>
                                            {emp.employee_grade && <span className="ml-1 badge-info border border-[var(--brand-primary)]">{emp.employee_grade}</span>}
                                        </td>
                                        <td>{emp.designation}</td>
                                        <td>{formatCurrency(emp.basic_salary)}</td>
                                        <td><span className={emp.nationality === 'Singapore Citizen' ? 'badge-success' : emp.nationality === 'SPR' ? 'badge-info' : 'badge-neutral'}>{emp.nationality}</span></td>
                                        <td><span className={emp.status === 'Active' ? 'badge-success' : 'badge-danger'}>{emp.status}</span></td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button onClick={() => navigate(`/employees/${emp.id}/kets`)} className="text-sm border border-[var(--border-main)] bg-[var(--bg-input)] rounded px-2 hover:bg-[var(--brand-primary)] hover:text-white transition-colors" title="KETs">📋</button>
                                                <button onClick={() => navigate(`/employees/${emp.id}/documents`)} className="text-sm border border-[var(--border-main)] bg-[var(--bg-input)] rounded px-2 hover:bg-[var(--brand-primary)] hover:text-white transition-colors" title="Documents">🪪</button>
                                                {emp.status === 'Active' && (
                                                    <button onClick={() => openTransferModal(emp)} className="text-sm border border-[var(--border-main)] bg-[var(--bg-input)] rounded px-2 hover:bg-[var(--brand-primary)] hover:text-white transition-colors" title="Transfer Entity">↗️</button>
                                                )}
                                                <button onClick={() => handleEdit(emp)} className="text-sm border border-[var(--border-main)] bg-[var(--bg-input)] rounded px-2 hover:bg-[var(--brand-primary)] hover:text-white transition-colors" title="Edit">✏️</button>
                                                <button onClick={() => handleDelete(emp.id)} className="text-sm border border-[var(--border-main)] bg-[var(--bg-input)] rounded px-2 hover:bg-[var(--danger)] hover:text-white transition-colors" title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="8" className="text-center py-8 text-[var(--text-muted)]">No employees found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>


            {/* Transfer Modal */}
            {showTransferModal && transferringEmp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card-base p-6 w-full max-w-md animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Transfer Employee</h2>
                            <button onClick={() => setShowTransferModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl">×</button>
                        </div>
                        <p className="text-[var(--text-muted)] text-sm mb-6">
                            Transferring <strong className="text-[var(--text-main)]">{transferringEmp.full_name}</strong>. Their KETs and Leave records will be cloned to the new entity.
                        </p>
                        <form onSubmit={handleTransfer} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[var(--text-main)] mb-1.5">Target Entity</label>
                                <select
                                    className="select-base"
                                    required
                                    value={targetEntityId}
                                    onChange={e => setTargetEntityId(e.target.value)}
                                >
                                    <option value="">Select an Entity to transfer to...</option>
                                    {entities.map(ent => (
                                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-[var(--border-main)] mt-4">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-input)] transition-all font-bold">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Transfer →</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <BulkImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onRefresh={load}
            />
        </div>
    )
}
