import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import api from '../services/api'

export default function EmployeeDocuments() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [employee, setEmployee] = useState(null)
    const [documents, setDocuments] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    const [form, setForm] = useState({
        document_type: 'NRIC',
        document_number: '',
        issue_date: '',
        expiry_date: ''
    })

    useEffect(() => {
        fetchData()
    }, [id])

    const fetchData = async () => {
        try {
            const [emp, docs] = await Promise.all([
                api.getEmployee(id),
                api.getDocuments(id)
            ])
            setEmployee(emp)
            setDocuments(docs)
        } catch (err) {
            toast.error(err.message)
            navigate('/employees')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await api.createDocument({ ...form, employee_id: id })
            toast.success('Document added successfully')
            setShowModal(false)
            setForm({ document_type: 'NRIC', document_number: '', issue_date: '', expiry_date: '' })
            fetchData()
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleDelete = async (docId) => {
        const result = await Swal.fire({
            title: 'Delete Document?',
            text: "Are you sure you want to permanently remove this document?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (!result.isConfirmed) return
        try {
            await api.deleteDocument(docId)
            toast.success('Document deleted')
            fetchData()
        } catch (err) {
            toast.error(err.message)
        }
    }

    if (loading) return <div className="flex justify-center p-12"><div className="loading-shimmer w-16 h-16 rounded-full" /></div>

    return (
        <div className="space-y-6 slide-up">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">
                        Identity & Documents
                    </h1>
                    <p className="text-[var(--text-muted)] mt-1">Managing documents for {employee?.full_name} ({employee?.employee_id})</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/employees')} className="btn-secondary">Back to Employees</button>
                    <button onClick={() => setShowModal(true)} className="btn-primary">Add Document</button>
                </div>
            </div>

            <div className="card-glass overflow-hidden">
                {documents.length === 0 ? (
                    <div className="p-8 text-center text-[var(--text-muted)]">No documents found for this employee.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-input)]">
                                    <th className="p-4 font-semibold text-[var(--text-muted)]">Type</th>
                                    <th className="p-4 font-semibold text-[var(--text-muted)]">Document No.</th>
                                    <th className="p-4 font-semibold text-[var(--text-muted)]">Issue Date</th>
                                    <th className="p-4 font-semibold text-[var(--text-muted)]">Expiry Date</th>
                                    <th className="p-4 font-semibold text-[var(--text-muted)]">Status</th>
                                    <th className="p-4 font-semibold text-[var(--text-muted)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map(doc => {
                                    let status = 'Valid'
                                    let statusColor = 'badge-success'

                                    if (doc.expiry_date) {
                                        const expiry = new Date(doc.expiry_date)
                                        const now = new Date()
                                        const daysDiff = (expiry - now) / (1000 * 60 * 60 * 24)

                                        if (daysDiff < 0) {
                                            status = 'Expired'
                                            statusColor = 'badge-danger'
                                        } else if (daysDiff <= 90) {
                                            status = `Expiring (${Math.ceil(daysDiff)} days)`
                                            statusColor = 'badge-warning'
                                        }
                                    }

                                    return (
                                        <tr key={doc.id} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)] transition-colors">
                                            <td className="p-4 font-medium text-[var(--text-main)]">{doc.document_type}</td>
                                            <td className="p-4">{doc.document_number}</td>
                                            <td className="p-4 text-[var(--text-muted)]">{doc.issue_date || '-'}</td>
                                            <td className="p-4 text-[var(--text-muted)]">{doc.expiry_date || '-'}</td>
                                            <td className="p-4"><span className={statusColor}>{status}</span></td>
                                            <td className="p-4">
                                                <button onClick={() => handleDelete(doc.id)} className="text-sm text-red-400 hover:text-red-300 transition-colors">Delete</button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Document Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm slide-up">
                    <div className="card-glass w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-6">Add Document</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Document Type</label>
                                <select
                                    className="select-base"
                                    value={form.document_type}
                                    onChange={e => setForm({ ...form, document_type: e.target.value })}
                                >
                                    <option>NRIC</option>
                                    <option>FIN</option>
                                    <option>Passport</option>
                                    <option>Work Permit</option>
                                    <option>S Pass</option>
                                    <option>Employment Pass</option>
                                    <option>Driving License</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Document No. / Unique ID</label>
                                <input
                                    type="text" required className="input-base"
                                    value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Issue Date</label>
                                    <input
                                        type="date" className="input-base" required
                                        value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Expiry Date</label>
                                    <input
                                        type="date" className="input-base"
                                        value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save Document</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
