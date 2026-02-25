import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function ShiftSettings() {
    const { role, activeEntity } = useAuth()
    const [loading, setLoading] = useState(false)
    const [shifts, setShifts] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)

    const defaultForm = {
        shift_name: '',
        start_time: '08:00',
        end_time: '17:00',
        ot_start_time: '17:30',
        late_arrival_threshold_mins: 15,
        early_departure_threshold_mins: 15,
        late_arrival_penalty_block_mins: 0,
        early_departure_penalty_block_mins: 0,
        compulsory_ot_hours: 0,
        lunch_break_mins: 60,
        dinner_break_mins: 0,
        midnight_break_mins: 0
    };
    const [form, setForm] = useState(defaultForm)

    const loadData = async () => {
        setLoading(true)
        try {
            const data = await api.getShiftSettings()
            setShifts(data)
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [activeEntity])

    const handleAdd = () => {
        setForm({ ...defaultForm, entity_id: activeEntity?.id })
        setShowModal(true)
    }

    const handleEdit = (item) => {
        setForm({ ...item })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = { ...form, entity_id: activeEntity?.id }
            await api.saveShiftSetting(payload)
            toast.success('Shift setting saved')
            setShowModal(false)
            loadData()
        } catch (err) { toast.error(err.message) }
    }

    const handleDelete = async () => {
        if (!itemToDelete) return
        try {
            await api.deleteShiftSetting(itemToDelete.id)
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
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Master Shift Configurations</h1>
                    <p className="text-[var(--text-muted)] mt-1">Configure global standard shifts and penalty rules for {activeEntity?.name || 'this entity'}.</p>
                </div>
                {canEditConfigs && (
                    <button onClick={handleAdd} className="btn-primary">+ Add Shift</button>
                )}
            </div>

            <div className="card-base overflow-hidden">
                {loading ? <div className="h-64 loading-shimmer" /> : (
                    <table className="table-theme w-full">
                        <thead>
                            <tr>
                                <th>Shift Name</th>
                                <th>Timings</th>
                                <th>OT Start</th>
                                <th>Breaks (L/D/M)</th>
                                <th>Late Grace (mins)</th>
                                <th>Penalty Block (mins)</th>
                                <th>Compulsory OT (hrs)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map(item => (
                                <tr key={item.id}>
                                    <td className="font-medium text-[var(--text-main)]">{item.shift_name}</td>
                                    <td>{item.start_time} - {item.end_time}</td>
                                    <td className="text-indigo-400">{item.ot_start_time}</td>
                                    <td className="text-[var(--text-muted)] text-xs">{item.lunch_break_mins}m / {item.dinner_break_mins}m / {item.midnight_break_mins}m</td>
                                    <td>{item.late_arrival_threshold_mins}</td>
                                    <td>{item.late_arrival_penalty_block_mins}</td>
                                    <td>{item.compulsory_ot_hours}</td>
                                    <td>
                                        {canEditConfigs && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="text-xs text-[var(--brand-primary)] hover:text-cyan-300 transition-colors">✏️ Edit</button>
                                                <button onClick={() => confirmDelete(item)} className="text-xs text-red-400 hover:text-red-300 transition-colors">🗑️ Delete</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {shifts.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center py-8 text-[var(--text-muted)]">No shift configurations found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto pt-20 pb-10">
                    <div className="card-base p-6 w-full max-w-2xl animate-slide-up my-auto" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-6">{form.id ? 'Edit' : 'Add'} Shift Configuration</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Shift Name</label>
                                    <input type="text" required value={form.shift_name} onChange={e => setForm({ ...form, shift_name: e.target.value })} className="input-base w-full" placeholder="e.g. Day, Night, Split" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Start Time (HH:mm)</label>
                                    <input type="time" required value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="input-base w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">End Time (HH:mm)</label>
                                    <input type="time" required value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="input-base w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5 text-indigo-400">OT Start Time (HH:mm)</label>
                                    <input type="time" required value={form.ot_start_time} onChange={e => setForm({ ...form, ot_start_time: e.target.value })} className="input-base w-full border-indigo-500/30" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Compulsory OT / Shift (Hours)</label>
                                    <input type="number" step="0.5" min="0" required value={form.compulsory_ot_hours} onChange={e => setForm({ ...form, compulsory_ot_hours: parseFloat(e.target.value) || 0 })} className="input-base w-full" />
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10">
                                <h3 className="text-sm font-semibold text-gray-300 mb-4">Meal Break Durations</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Lunch (Mins)</label>
                                        <input type="number" min="0" required value={form.lunch_break_mins} onChange={e => setForm({ ...form, lunch_break_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Dinner (Mins)</label>
                                        <input type="number" min="0" required value={form.dinner_break_mins} onChange={e => setForm({ ...form, dinner_break_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Midnight (Mins)</label>
                                        <input type="number" min="0" required value={form.midnight_break_mins} onChange={e => setForm({ ...form, midnight_break_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10">
                                <h3 className="text-sm font-semibold text-gray-300 mb-4">Lateness & Early Departure Thresholds</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Late Grace Period (Mins)</label>
                                        <input type="number" min="0" required value={form.late_arrival_threshold_mins} onChange={e => setForm({ ...form, late_arrival_threshold_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Early Exit Grace Period (Mins)</label>
                                        <input type="number" min="0" required value={form.early_departure_threshold_mins} onChange={e => setForm({ ...form, early_departure_threshold_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5 text-rose-400">Late Penalty Rounding Block (Mins)</label>
                                        <input type="number" min="0" required value={form.late_arrival_penalty_block_mins} onChange={e => setForm({ ...form, late_arrival_penalty_block_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                        <p className="text-[10px] text-gray-500 mt-1">E.g. 15 = Round up to nearest 15m. 0 = exact minutes.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5 text-rose-400">Early Penalty Rounding Block (Mins)</label>
                                        <input type="number" min="0" required value={form.early_departure_penalty_block_mins} onChange={e => setForm({ ...form, early_departure_penalty_block_mins: parseInt(e.target.value) || 0 })} className="input-base w-full" />
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-amber-400 mt-4 leading-relaxed">
                                <strong>Note:</strong> These Master Shift Settings act as global fallbacks. If an employee is mapped to a highly specific Site Matrix, the Site settings will take precedence during attendance imports.
                            </p>

                            <div className="flex gap-3 pt-4 border-t border-[var(--border-main)] mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Configuration</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <DeleteConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                itemName={`Shift Configuration: ${itemToDelete?.shift_name}`}
            />
        </div>
    )
}
