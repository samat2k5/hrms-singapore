import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'

const emptyEmployee = {
    employee_id: '', full_name: '', date_of_birth: '', national_id: '', nationality: 'Citizen',
    tax_residency: 'Resident', race: 'Chinese', designation: '', department: '', employee_group: 'General',
    date_joined: '', basic_salary: 0, transport_allowance: 0, meal_allowance: 0,
    other_allowance: 0, bank_name: '', bank_account: '', cpf_applicable: 1, status: 'Active',
}

const Field = ({ label, name, type = 'text', options, required, span2, form, setForm, min, max }) => (
    <div className={span2 ? 'md:col-span-2' : ''}>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
        {options ? (
            <select value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} className="select-glass">
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        ) : (
            <input
                type={type}
                value={form[name]}
                onChange={e => setForm({ ...form, [name]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                className="input-glass"
                required={required}
                step={type === 'number' ? '0.01' : undefined}
            />
        )}
    </div>
)

export default function Employees() {
    const [employees, setEmployees] = useState([])
    const [configDepartments, setConfigDepartments] = useState([])
    const [configGroups, setConfigGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(emptyEmployee)
    const [documents, setDocuments] = useState([])
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('All')

    // Transfer feature state
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transferringEmp, setTransferringEmp] = useState(null)
    const [targetEntityId, setTargetEntityId] = useState('')
    const [entities, setEntities] = useState([])

    const navigate = useNavigate()

    const load = () => {
        Promise.all([
            api.getEmployees(),
            api.getDepartments(),
            api.getEmployeeGroups(),
            api.getEntities()
        ])
            .then(([emps, depts, grps, ents]) => {
                setEmployees(emps)
                setConfigDepartments(depts)
                setConfigGroups(grps)
                setEntities(ents)
            })
            .catch(e => toast.error(e.message))
            .finally(() => setLoading(false))
    }
    useEffect(load, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            let savedEmployee = null;
            if (editing) {
                savedEmployee = await api.updateEmployee(editing.id, form)
                toast.success('Employee updated')
            } else {
                savedEmployee = await api.createEmployee(form)
                toast.success('Employee added')
            }
            if (savedEmployee.warning) {
                toast((t) => (
                    <span><b>Warning:</b> {savedEmployee.warning}</span>
                ), { icon: '⚠️', duration: 6000 });
            }

            // Upload any attached documents sequentially
            if (documents.length > 0) {
                const uploadPromises = documents.map(async (doc) => {
                    const formData = new FormData();
                    formData.append('employee_id', savedEmployee.id);
                    formData.append('document_type', doc.document_type);
                    formData.append('document_number', doc.document_number);
                    if (doc.issue_date) formData.append('issue_date', doc.issue_date);
                    if (doc.expiry_date) formData.append('expiry_date', doc.expiry_date);
                    if (doc.file) formData.append('file', doc.file);

                    // api.js request will detect FormData and leave Content-Type empty automatically
                    return api.createDocument(formData);
                });

                await Promise.all(uploadPromises);
                toast.success(`Uploaded ${documents.length} documents successfully`);
            }

            setShowModal(false)
            setEditing(null)
            setForm(emptyEmployee)
            setDocuments([])
            load()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleEdit = (emp) => {
        setEditing(emp)
        setForm({ ...emp })
        setShowModal(true)
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Employees</h1>
                    <p className="text-slate-400 mt-1">{employees.length} total · {employees.filter(e => e.status === 'Active').length} active</p>
                </div>
                <button onClick={() => { setEditing(null); setForm(emptyEmployee); setShowModal(true) }} className="gradient-btn">+ Add Employee</button>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input-glass flex-1 max-w-md"
                />
                <select value={filter} onChange={e => setFilter(e.target.value)} className="select-glass w-40">
                    <option>All</option>
                    <option>Active</option>
                    <option>Inactive</option>
                </select>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <div className="overflow-x-auto">
                        <table className="table-glass">
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
                                        <td className="font-medium text-cyan-400">{emp.employee_id}</td>
                                        <td className="font-medium text-white">{emp.full_name}</td>
                                        <td>{emp.department}</td>
                                        <td><span className="badge-neutral border border-white/10">{emp.employee_group || 'General'}</span></td>
                                        <td>{emp.designation}</td>
                                        <td>{formatCurrency(emp.basic_salary)}</td>
                                        <td><span className={emp.nationality === 'Citizen' ? 'badge-success' : emp.nationality === 'PR' ? 'badge-info' : 'badge-neutral'}>{emp.nationality}</span></td>
                                        <td><span className={emp.status === 'Active' ? 'badge-success' : 'badge-danger'}>{emp.status}</span></td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button onClick={() => navigate(`/employees/${emp.id}/kets`)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors" title="KETs">📋</button>
                                                <button onClick={() => navigate(`/employees/${emp.id}/documents`)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors" title="Documents">🪪</button>
                                                {emp.status === 'Active' && (
                                                    <button onClick={() => openTransferModal(emp)} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors" title="Transfer Entity">↗️</button>
                                                )}
                                                <button onClick={() => handleEdit(emp)} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors" title="Edit">✏️</button>
                                                <button onClick={() => handleDelete(emp.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors" title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="8" className="text-center py-8 text-slate-500">No employees found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">{editing ? 'Edit Employee' : 'Add New Employee'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field form={form} setForm={setForm} label="Employee ID" name="employee_id" required />
                            <Field form={form} setForm={setForm} label="Full Name" name="full_name" required />
                            <Field form={form} setForm={setForm} label="Date of Birth" name="date_of_birth" type="date" required />
                            <Field form={form} setForm={setForm} label="Date Joined" name="date_joined" type="date" required />
                            <Field form={form} setForm={setForm} label="Nationality" name="nationality" options={['Citizen', 'PR', 'Foreigner']} />
                            <Field form={form} setForm={setForm} label="National ID (NRIC/FIN)" name="national_id" required={['Citizen', 'PR'].includes(form.nationality)} />
                            <Field form={form} setForm={setForm} label="Tax Residency" name="tax_residency" options={['Resident', 'Non-Resident']} />
                            <Field form={form} setForm={setForm} label="Race" name="race" options={['Chinese', 'Indian', 'Malay', 'Eurasian', 'Other']} />
                            <Field form={form} setForm={setForm} label="Status" name="status" options={['Active', 'Inactive']} />

                            {/* Dynamic Departments Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
                                <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="select-glass">
                                    <option value="">Select a Department...</option>
                                    {configDepartments.map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dynamic Groups Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Employee Group</label>
                                <select value={form.employee_group} onChange={e => setForm({ ...form, employee_group: e.target.value })} className="select-glass">
                                    {configGroups.map(g => (
                                        <option key={g.id} value={g.name}>{g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <Field form={form} setForm={setForm} label="Designation" name="designation" />
                            <Field form={form} setForm={setForm} label="Basic Salary (S$)" name="basic_salary" type="number" />
                            <Field form={form} setForm={setForm} label="Transport Allowance" name="transport_allowance" type="number" />
                            <Field form={form} setForm={setForm} label="Meal Allowance" name="meal_allowance" type="number" />
                            <Field form={form} setForm={setForm} label="Other Allowance" name="other_allowance" type="number" />
                            <Field form={form} setForm={setForm} label="Bank Name" name="bank_name" />
                            <Field form={form} setForm={setForm} label="Bank Account" name="bank_account" />
                            <div className="md:col-span-2 flex items-center gap-3">
                                <input type="checkbox" checked={form.cpf_applicable === 1} onChange={e => setForm({ ...form, cpf_applicable: e.target.checked ? 1 : 0 })} className="w-4 h-4 rounded accent-cyan-500" />
                                <label className="text-sm text-slate-300">CPF Applicable (Singapore Citizens & PR only)</label>
                            </div>
                            <div className="md:col-span-2 pt-6 border-t border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-medium text-white">ID Documents & Passes</h3>
                                    <button
                                        type="button"
                                        onClick={() => setDocuments([...documents, { document_type: 'NRIC', document_number: '', issue_date: '', expiry_date: '', file: null }])}
                                        className="text-sm px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
                                    >
                                        + Add Document
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {documents.map((doc, index) => (
                                        <div key={index} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-white/5 relative">
                                            <button
                                                type="button"
                                                onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center text-xs hover:bg-red-400"
                                            >
                                                ×
                                            </button>

                                            <select
                                                value={doc.document_type}
                                                onChange={e => {
                                                    const newDocs = [...documents];
                                                    newDocs[index].document_type = e.target.value;
                                                    setDocuments(newDocs);
                                                }}
                                                className="select-glass w-32 !py-1.5"
                                            >
                                                <option>NRIC</option>
                                                <option>FIN</option>
                                                <option>Passport</option>
                                                <option>Work Pass</option>
                                                <option>Skill Pass</option>
                                            </select>

                                            <input
                                                type="text"
                                                placeholder="Doc Number"
                                                required
                                                value={doc.document_number}
                                                onChange={e => {
                                                    const newDocs = [...documents];
                                                    newDocs[index].document_number = e.target.value;
                                                    setDocuments(newDocs);
                                                }}
                                                className="input-glass flex-1 min-w-[120px] !py-1.5"
                                            />

                                            <input
                                                type="date"
                                                placeholder="Issue Date"
                                                value={doc.issue_date}
                                                onChange={e => {
                                                    const newDocs = [...documents];
                                                    newDocs[index].issue_date = e.target.value;
                                                    setDocuments(newDocs);
                                                }}
                                                className="input-glass w-[130px] !py-1.5"
                                            />

                                            <input
                                                type="date"
                                                placeholder="Expiry Date"
                                                value={doc.expiry_date}
                                                onChange={e => {
                                                    const newDocs = [...documents];
                                                    newDocs[index].expiry_date = e.target.value;
                                                    setDocuments(newDocs);
                                                }}
                                                className="input-glass w-[130px] !py-1.5"
                                            />

                                            <input
                                                type="file"
                                                onChange={e => {
                                                    const newDocs = [...documents];
                                                    newDocs[index].file = e.target.files[0];
                                                    setDocuments(newDocs);
                                                }}
                                                className="w-full text-sm text-slate-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
                                            />
                                        </div>
                                    ))}
                                    {documents.length === 0 && (
                                        <p className="text-slate-500 text-sm italic text-center py-2">No documents attached. Click 'Add Document' to attach passes or IDs.</p>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-2 flex gap-3 pt-4 border-t border-white/5 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">{editing ? 'Update' : 'Add Employee'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {showTransferModal && transferringEmp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-6 w-full max-w-md animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">Transfer Employee</h2>
                            <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <p className="text-slate-300 text-sm mb-6">
                            Transferring <strong className="text-white">{transferringEmp.full_name}</strong>. Their KETs and Leave records will be cloned to the new entity.
                        </p>
                        <form onSubmit={handleTransfer} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Entity</label>
                                <select
                                    className="select-glass"
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
                            <div className="flex gap-3 pt-4 border-t border-white/5 mt-4">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="gradient-btn flex-1">Transfer →</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
