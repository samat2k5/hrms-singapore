import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatDate, formatCurrency } from '../utils/formatters'

export default function EmployeeKETs() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [ket, setKet] = useState(null)
    const [employee, setEmployee] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({})

    useEffect(() => {
        Promise.all([api.getKETs(id), api.getEmployee(id)])
            .then(([ketData, empData]) => {
                setKet(ketData)
                setEmployee(empData)
                setForm(ketData)
            })
            .catch(e => toast.error(e.message))
            .finally(() => setLoading(false))
    }, [id])

    const handleSave = async () => {
        try {
            await api.updateKETs(id, form)
            toast.success('KETs updated')
            setEditing(false)
            const updated = await api.getKETs(id)
            setKet(updated)
            setForm(updated)
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleIssue = async () => {
        if (!confirm('Issue this KET document? This marks it as officially issued to the employee.')) return
        try {
            await api.issueKETs(id)
            toast.success('KETs issued successfully')
            const updated = await api.getKETs(id)
            setKet(updated)
            setForm(updated)
        } catch (err) {
            toast.error(err.message)
        }
    }

    if (loading) return <div className="glass-card h-96 loading-shimmer" />
    if (!ket) return <div className="text-center py-20 text-slate-400">KETs not found</div>

    const Field = ({ label, name, type = 'text', options, disabled, span2 }) => (
        <div className={span2 ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
            {!editing || disabled ? (
                <p className="text-sm text-white py-2">{type === 'currency' ? formatCurrency(form[name]) : (form[name] || '—')}</p>
            ) : options ? (
                <select value={form[name] || ''} onChange={e => setForm({ ...form, [name]: e.target.value })} className="select-glass text-sm">
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    type={type === 'currency' ? 'number' : type}
                    value={form[name] || ''}
                    onChange={e => setForm({ ...form, [name]: type === 'currency' || type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                    className="input-glass text-sm"
                    step={type === 'currency' || type === 'number' ? '0.01' : undefined}
                />
            )}
        </div>
    )

    const allowances = form.fixed_allowances || {}
    const deductions = form.fixed_deductions || {}

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/employees')} className="text-slate-400 hover:text-white transition-colors">← Back</button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Key Employment Terms</h1>
                        <p className="text-slate-400">{employee?.full_name} ({employee?.employee_id})</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!editing ? (
                        <>
                            <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm transition-all">✏️ Edit</button>
                            {!ket.issued_date && (
                                <button onClick={handleIssue} className="gradient-btn text-sm">📋 Issue KET</button>
                            )}
                        </>
                    ) : (
                        <>
                            <button onClick={() => { setEditing(false); setForm(ket) }} className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm transition-all">Cancel</button>
                            <button onClick={handleSave} className="gradient-btn text-sm">💾 Save Changes</button>
                        </>
                    )}
                </div>
            </div>

            {/* Status Banner */}
            {ket.issued_date ? (
                <div className="glass-card p-4 border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">✅</span>
                        <div>
                            <p className="text-sm font-medium text-emerald-400">KETs Issued</p>
                            <p className="text-xs text-slate-400">Officially issued on {formatDate(ket.issued_date)}</p>
                        </div>
                    </div>
                </div>
            ) : ket.is_overdue ? (
                <div className="glass-card p-4 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">⚠️</span>
                        <div>
                            <p className="text-sm font-medium text-red-400">OVERDUE — KETs must be issued within 14 days of start date</p>
                            <p className="text-xs text-slate-400">Deadline was {formatDate(ket.deadline)}. Please issue immediately to comply with MOM requirements.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">📝</span>
                        <div>
                            <p className="text-sm font-medium text-amber-400">KETs Not Yet Issued</p>
                            <p className="text-xs text-slate-400">Must be issued within 14 days of employment start date per MOM guidelines.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* KET Sections */}
            <div className="grid gap-6">
                {/* Employment Details */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">🏢 Employment Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Employer Name" name="_employer" disabled />
                        <Field label="Employee Name" name="employee_name" disabled />
                        <Field label="Employee Code" name="employee_code" disabled />
                        <Field label="Job Title & Duties" name="job_title" span2 />
                        <Field label="Employment Start Date" name="employment_start_date" type="date" />
                        <Field label="Employment Type" name="employment_type" options={['Permanent', 'Contract', 'Part-time']} />
                        <Field label="Contract Duration" name="contract_duration" />
                        <Field label="Probation Period (months)" name="probation_months" type="number" />
                    </div>
                </div>

                {/* Working Arrangements */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">🕐 Working Arrangements</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Working Hours Per Day" name="working_hours_per_day" type="number" />
                        <Field label="Working Days Per Week" name="working_days_per_week" type="number" />
                        <Field label="Rest Day" name="rest_day" options={['Sunday', 'Saturday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']} />
                        <Field label="Place of Work" name="place_of_work" span2 />
                    </div>
                </div>

                {/* Salary & Remuneration */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">💰 Salary & Remuneration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Salary Period" name="salary_period" options={['Monthly', 'Weekly', 'Daily']} />
                        <Field label="Basic Salary" name="basic_salary" type="currency" />
                        <Field label="Overtime Rate (per hour)" name="overtime_rate" type="currency" />
                        <Field label="Overtime Payment Period" name="overtime_payment_period" />
                        <Field label="Bonus/Incentive Structure" name="bonus_structure" span2 />
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fixed Allowances</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div><span className="text-slate-400">Transport:</span> <span className="text-white">{formatCurrency(allowances.transport)}</span></div>
                            <div><span className="text-slate-400">Meal:</span> <span className="text-white">{formatCurrency(allowances.meal)}</span></div>
                        </div>
                    </div>
                </div>

                {/* Leave & Benefits */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">🌴 Leave Entitlements & Medical Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Annual Leave (days)" name="annual_leave_days" type="number" />
                        <Field label="Outpatient Sick Leave (days)" name="sick_leave_days" type="number" />
                        <Field label="Hospitalization Leave (days)" name="hospitalization_days" type="number" />
                        <Field label="Maternity Leave (weeks)" name="maternity_weeks" type="number" />
                        <Field label="Paternity Leave (weeks)" name="paternity_weeks" type="number" />
                        <Field label="Childcare Leave (days)" name="childcare_days" type="number" />
                        <Field label="Medical Benefits" name="medical_benefits" span2 />
                    </div>
                </div>

                {/* Notice Period */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">📄 Other Terms</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Notice Period" name="notice_period" />
                    </div>
                </div>
            </div>

            {/* MOM Compliance Note */}
            <div className="glass-card p-4 border-cyan-500/20 bg-cyan-500/5">
                <p className="text-xs text-cyan-300 font-medium mb-1">📋 MOM Compliance Note</p>
                <p className="text-xs text-slate-400">This document contains all 17 mandatory fields as required by the Ministry of Manpower (MOM) for Key Employment Terms under the Employment Act. KETs must be issued within 14 days of the employee's start date.</p>
            </div>
        </div>
    )
}
