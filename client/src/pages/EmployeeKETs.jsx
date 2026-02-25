import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatCurrency } from '../utils/formatters'

const loadLogo = (url) => {
    return new Promise((resolve) => {
        if (!url) return resolve('/ezyhr-logo.png');
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve('/ezyhr-logo.png');
        img.src = url;
    });
};

const Field = ({ label, name, type = 'text', options, disabled, span2, form, setForm, editing, employee, formatCurrency, value: customValue, onChange: customOnChange }) => {
    const value = customValue !== undefined ? customValue : form[name];

    return (
        <div className={span2 ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{label}</label>
            {!editing || disabled ? (
                <p className="text-sm text-[var(--text-main)] py-2">
                    {type === 'currency' ? formatCurrency(value) :
                        type === 'checkbox' ? (value ? 'Yes' : 'No') :
                            ((value !== undefined && value !== null && value !== '') ? value : (employee?.[name] || '—'))}
                </p>
            ) : type === 'checkbox' ? (
                <div className="flex items-center gap-2 py-2">
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={e => customOnChange ? customOnChange(e.target.checked) : setForm({ ...form, [name]: e.target.checked })}
                        className="w-4 h-4 rounded border-[var(--border-main)] bg-[var(--bg-input)]"
                    />
                    <span className="text-sm text-[var(--text-main)]">{label}</span>
                </div>
            ) : options ? (
                <select
                    value={value || ''}
                    onChange={e => customOnChange ? customOnChange(e.target.value) : setForm({ ...form, [name]: e.target.value })}
                    className="select-base text-sm"
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : type === 'textarea' ? (
                <textarea
                    value={value || ''}
                    onChange={e => customOnChange ? customOnChange(e.target.value) : setForm({ ...form, [name]: e.target.value })}
                    className="input-base text-sm min-h-[80px]"
                />
            ) : (
                <input
                    type={type === 'currency' ? 'number' : type}
                    value={value ?? ''}
                    onChange={e => {
                        const val = (type === 'currency' || type === 'number') ? parseFloat(e.target.value) || 0 : e.target.value;
                        if (customOnChange) customOnChange(val);
                        else setForm({ ...form, [name]: val });
                    }}
                    className="input-base text-sm"
                    step={type === 'currency' || type === 'number' ? '0.01' : undefined}
                />
            )}
        </div>
    )
}

export default function EmployeeKETs() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [ket, setKet] = useState(null)
    const [employee, setEmployee] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({})
    const { activeEntity } = useAuth()

    useEffect(() => {
        Promise.all([api.getKETs(id), api.getEmployee(id)])
            .then(([ketData, empData]) => {
                let parsedAllowances = [], parsedDeductions = [];
                try {
                    if (ketData.custom_allowances) {
                        const obj = JSON.parse(ketData.custom_allowances);
                        parsedAllowances = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                    }
                    if (ketData.custom_deductions) {
                        const obj = JSON.parse(ketData.custom_deductions);
                        parsedDeductions = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                    }
                } catch (e) { }

                const mergedKet = {
                    ...ketData,
                    entity_name: ketData.entity_name || empData.entity_name || activeEntity?.name || ''
                };

                setKet(mergedKet)
                setEmployee(empData)
                setForm({ ...mergedKet, _parsedCustomAllowances: parsedAllowances, _parsedCustomDeductions: parsedDeductions })
            })
            .catch(e => toast.error(e.message))
            .finally(() => setLoading(false))
    }, [id])

    const handleSave = async () => {
        try {
            const payload = { ...form };
            const cAllowances = {};
            payload._parsedCustomAllowances?.forEach(item => { if (item.key) cAllowances[item.key] = Number(item.value) || 0; });
            const cDeductions = {};
            payload._parsedCustomDeductions?.forEach(item => { if (item.key) cDeductions[item.key] = Number(item.value) || 0; });

            payload.custom_allowances = JSON.stringify(cAllowances);
            payload.custom_deductions = JSON.stringify(cDeductions);
            delete payload._parsedCustomAllowances;
            delete payload._parsedCustomDeductions;

            const updated = await api.updateKETs(id, payload)
            toast.success('KETs updated')
            setEditing(false)

            let pAllowances = [], pDeductions = [];
            try {
                if (updated.custom_allowances) {
                    const obj = typeof updated.custom_allowances === 'string' ? JSON.parse(updated.custom_allowances) : updated.custom_allowances;
                    pAllowances = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                }
                if (updated.custom_deductions) {
                    const obj = typeof updated.custom_deductions === 'string' ? JSON.parse(updated.custom_deductions) : updated.custom_deductions;
                    pDeductions = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                }
            } catch (e) { }

            const merged = { ...updated, entity_name: updated.entity_name || employee?.entity_name || activeEntity?.name || '' };
            setKet(merged)
            setForm({ ...merged, _parsedCustomAllowances: pAllowances, _parsedCustomDeductions: pDeductions })
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

            let pAllowances = [], pDeductions = [];
            try {
                if (updated.custom_allowances) {
                    const obj = JSON.parse(updated.custom_allowances);
                    pAllowances = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                }
                if (updated.custom_deductions) {
                    const obj = JSON.parse(updated.custom_deductions);
                    pDeductions = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                }
            } catch (e) { }

            const merged = { ...updated, entity_name: updated.entity_name || employee?.entity_name || activeEntity?.name || '' };
            setKet(merged)
            setForm({ ...merged, _parsedCustomAllowances: pAllowances, _parsedCustomDeductions: pDeductions })
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleTransmit = async (mode) => {
        if (!ket) return;

        if (mode === 'whatsapp') {
            const phone = ket.whatsapp_number || ket.mobile_number || employee?.whatsapp_number || employee?.mobile_number;
            console.log('[KET_TRANSMIT] WhatsApp Mode - Phone:', phone);
            if (!phone) {
                toast.error('WhatsApp/Mobile number not found for this employee');
                return;
            }
            const cleanPhone = phone.replace(/\D/g, '');
            const message = encodeURIComponent(`Hi ${ket.employee_name || employee?.full_name}, your Key Employment Terms (KET) document is ready. You can view it on the ezyHR Portal.`);
            window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
        } else if (mode === 'email') {
            const email = ket.email || employee?.email;
            console.log('[KET_TRANSMIT] Email Mode - Email:', email);
            if (!email) {
                toast.error('Employee email not found');
                return;
            }

            const tid = toast.loading('Preparing KET and sending email...');
            try {
                const doc = await generatePDFDoc();
                const pdfBase64 = doc.output('datauristring');

                await api.transmitEmail({
                    employeeId: ket.employee_id,
                    pdfBase64,
                    fileName: `KET_${ket.employee_name.replace(/\s+/g, '_')}.pdf`,
                    subject: `Your Key Employment Terms (KET) - ${activeEntity?.name || 'ezyHR'}`,
                    message: `Dear ${ket.employee_name},\n\nPlease find your Key Employment Terms (KET) document attached.\n\nRegards,\n${activeEntity?.name || 'ezyHR'} Team`
                });

                toast.success('KET sent via email successfully', { id: tid });
            } catch (err) {
                console.error(err);
                toast.error('Failed to transmit email: ' + err.message, { id: tid });
            }
        }
    }

    const generatePDFDoc = async () => {
        const jspdfModule = await import('jspdf');
        const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
        const autotableModule = await import('jspdf-autotable');
        const autoTable = autotableModule.default || autotableModule;

        if (!jsPDF || !autoTable) throw new Error("PDF libraries failed to load");
        if (!ket) throw new Error("KET data missing");

        const doc = new jsPDF()

        // Header Branding Update
        const logo = await loadLogo(ket.logo_url);
        doc.addImage(logo, ket.logo_url ? (ket.logo_url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG') : 'PNG', 14, 10, 40, 20);

        doc.setFontSize(18)
        doc.setTextColor(6, 182, 212)
        doc.text('Key Employment Terms (KET)', 60, 25)

        doc.setFontSize(11)
        doc.setTextColor(0)
        let yText = 40
        doc.text(`Employer: ${ket.entity_name || employee?.entity_name || activeEntity?.name || 'Company Name'}`, 14, yText)
        doc.text(`Employee: ${employee?.full_name || ''} (${employee?.employee_id || ''})`, 14, yText + 6)
        doc.text(`Issue Date: ${ket.issued_date ? formatDate(ket.issued_date) : 'Draft'}`, 14, yText + 12)

        const body = [
            ['Job Title', ket.job_title || ''],
            ['Main Duties and Responsibilities', ket.main_duties || ''],
            ['Employment Start Date', ket.employment_start_date ? formatDate(ket.employment_start_date) : ''],
            ['Employment End Date', ket.employment_end_date ? formatDate(ket.employment_end_date) : 'N.A.'],
            ['Employment Type', ket.employment_type || ''],
            ['Daily Working Hours', ket.working_hours_details || `${ket.working_hours_per_day} hours/day`],
            ['Break During Work', ket.break_hours || '—'],
            ['Number of Working Days/Week', ket.working_days_per_week?.toString() || ''],
            ['Rest Day', ket.rest_day || ''],
            ['Salary Period', ket.salary_period || ''],
            ['Date(s) of Salary Payment', ket.salary_payment_date || '—'],
            ['Date(s) of Overtime Payment', ket.overtime_payment_date || '—'],
            ['Basic Rate of Pay', formatCurrency(ket.basic_salary)],
            ['Gross Rate of Pay', formatCurrency(ket.gross_rate_of_pay)],
            ['Overtime Rate of Pay', formatCurrency(ket.overtime_rate)],
            ['Fixed Allowances', `Transport: ${formatCurrency(ket.fixed_allowances?.transport)} | Meal: ${formatCurrency(ket.fixed_allowances?.meal)}`],
            ['Other Salary Components', ket.other_salary_components || '—'],
            ['CPF Contributions Payable', ket.cpf_payable ? 'Yes' : 'No']
        ];

        let cAllowances = "";
        let cDeductions = "";
        try {
            if (ket.custom_allowances && ket.custom_allowances !== '{}') {
                const ca = JSON.parse(ket.custom_allowances);
                Object.keys(ca).forEach(k => {
                    if (ca[k]) cAllowances += `${k}: ${formatCurrency(ca[k])}\n`;
                });
            }
            if (ket.custom_deductions && ket.custom_deductions !== '{}') {
                const cd = JSON.parse(ket.custom_deductions);
                Object.keys(cd).forEach(k => {
                    if (cd[k]) cDeductions += `${k}: ${formatCurrency(cd[k])}\n`;
                });
            }
        } catch (e) { }

        if (cAllowances) body.push(['Custom Allowances', cAllowances.trim()]);
        if (cDeductions) body.push(['Custom Deductions', cDeductions.trim()]);

        const leaveBody = [
            ['Paid Annual Leave', `${ket.annual_leave_days} days/year`],
            ['Paid Outpatient Sick Leave', `${ket.sick_leave_days} days/year`],
            ['Paid Hospitalisation Leave', `${ket.hospitalization_days} days/year`],
            ['Medical Benefits', ket.medical_benefits || '—']
        ];

        autoTable(doc, {
            startY: 60,
            head: [['Term Details', 'Value']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
            margin: { bottom: 30 }
        })

        autoTable(doc, {
            startY: (doc.lastAutoTable ? doc.lastAutoTable.finalY : 60) + 10,
            head: [['Leave & Medical Benefits', 'Value']],
            body: leaveBody,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
            margin: { bottom: 30 }
        })

        const otherBody = [
            ['Length of Probation', `${ket.probation_months} months`],
            ['Probation Start Date', ket.probation_start_date ? formatDate(ket.probation_start_date) : '—'],
            ['Probation End Date', ket.probation_end_date ? formatDate(ket.probation_end_date) : '—'],
            ['Notice Period (Termination)', ket.notice_period || '—']
        ];

        autoTable(doc, {
            startY: (doc.lastAutoTable ? doc.lastAutoTable.finalY : 60) + 10,
            head: [['Other Terms', 'Value']],
            body: otherBody,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
            margin: { bottom: 30 }
        })

        // Footer Branding
        doc.setFontSize(7)
        doc.setTextColor(150)
        const footerY = 285;
        try {
            const ezyLogo = new Image();
            ezyLogo.src = '/ezyhr-logo.png';
            doc.addImage(ezyLogo, 'PNG', 14, footerY - 5, 12, 6);
            doc.text('Powered by ezyHR — The Future of Payroll', 28, footerY);
        } catch (e) { }
        doc.text('This is a computer-generated KET document. Compliant with Singapore MOM Employment Act requirements.', 105, footerY + 5, { align: 'center' })

        return doc;
    }

    const handleGeneratePDF = async () => {
        try {
            const doc = await generatePDFDoc();
            doc.save(`KET_${employee?.full_name?.replace(/\s+/g, '_') || 'Employee'}.pdf`)
            toast.success('KET PDF Generated!')
        } catch (err) {
            console.error('[KET_PDF_ERROR]', err)
            toast.error('Failed to generate PDF: ' + (err.message || 'Unknown error'))
        }
    }

    if (loading) return <div className="card-base h-96 loading-shimmer" />
    if (!ket) return <div className="text-center py-20 text-[var(--text-muted)]">KETs not found</div>

    const allowances = form.fixed_allowances || {}
    const deductions = form.fixed_deductions || {}

    const fieldProps = { form, setForm, editing, employee, formatCurrency };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/employees')} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">← Back</button>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)]">Key Employment Terms</h1>
                        <p className="text-[var(--text-muted)]">{employee?.full_name} ({employee?.employee_id})</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!editing ? (
                        <>
                            <div className="dropdown dropdown-end">
                                <button tabIndex={0} className="px-4 py-2 rounded-xl border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center gap-2">
                                    <span>📤 Transmit</span>
                                    <span className="text-[10px]">▼</span>
                                </button>
                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-2xl bg-[var(--bg-main)] border border-[var(--border-main)] rounded-xl w-52 mt-2">
                                    <li>
                                        <button onClick={() => handleTransmit('email')} className="text-[var(--text-main)] hover:bg-[var(--brand-primary)]/10">
                                            <span>📧 Send via Email</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button onClick={() => handleTransmit('whatsapp')} className="text-[var(--text-main)] hover:bg-emerald-500/10">
                                            <span>💬 Share via WhatsApp</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                            <button onClick={handleGeneratePDF} className="px-4 py-2 rounded-xl border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-input)] text-sm transition-all flex items-center gap-2">📄 Download PDF</button>
                            <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] text-sm transition-all">✏️ Edit</button>
                            {!ket.issued_date && (
                                <button onClick={handleIssue} className="btn-primary text-sm">📋 Issue KET</button>
                            )}
                        </>
                    ) : (
                        <>
                            <button onClick={() => { setEditing(false); setForm({ ...ket, _parsedCustomAllowances: form._parsedCustomAllowances, _parsedCustomDeductions: form._parsedCustomDeductions }) }} className="px-4 py-2 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] text-sm transition-all">Cancel</button>
                            <button onClick={handleSave} className="btn-primary text-sm">💾 Save Changes</button>
                        </>
                    )}
                </div>
            </div>

            {/* Status Banner */}
            {ket.issued_date ? (
                <div className="card-base p-4 border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">✅</span>
                        <div>
                            <p className="text-sm font-medium text-emerald-400">KETs Issued</p>
                            <p className="text-xs text-[var(--text-muted)]">Officially issued on {formatDate(ket.issued_date)}</p>
                        </div>
                    </div>
                </div>
            ) : ket.is_overdue ? (
                <div className="card-base p-4 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">⚠️</span>
                        <div>
                            <p className="text-sm font-medium text-red-400">OVERDUE — KETs must be issued within 14 days of start date</p>
                            <p className="text-xs text-[var(--text-muted)]">Deadline was {formatDate(ket.deadline)}. Please issue immediately to comply with MOM requirements.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card-base p-4 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">📝</span>
                        <div>
                            <p className="text-sm font-medium text-amber-400">KETs Not Yet Issued</p>
                            <p className="text-xs text-[var(--text-muted)]">Must be issued within 14 days of employment start date per MOM guidelines.</p>
                        </div>
                    </div>
                </div>
            )
            }

            {/* KET Sections */}
            <div className="grid gap-6">
                {/* Employment Details */}
                <div className="card-base p-6">
                    <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 pb-3 border-b border-[var(--border-main)]">🏢 Section A | Employment Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Employer Name" name="entity_name" disabled {...fieldProps} />
                        <Field label="Employee Name" name="employee_name" disabled {...fieldProps} />
                        <Field label="Employee Code" name="employee_code" disabled {...fieldProps} />
                        <Field label="Job Title" name="job_title" {...fieldProps} />
                        <Field label="Employment Type" name="employment_type" options={['Full-Time Employment', 'Part-Time Employment']} {...fieldProps} />
                        <Field label="Main Duties and Responsibilities" name="main_duties" type="textarea" span2 {...fieldProps} />
                        <Field label="Employment Start Date" name="employment_start_date" type="date" {...fieldProps} />
                        <Field label="Employment End Date (fixed-term)" name="employment_end_date" type="date" {...fieldProps} />
                        <Field label="Place of Work" name="place_of_work" span2 {...fieldProps} />
                    </div>
                </div>

                {/* Working Hours and Rest Day */}
                <div className="card-base p-6">
                    <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 pb-3 border-b border-[var(--border-main)]">🕐 Section B | Working Hours and Rest Day</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Daily Working Hours (Start/End)" name="working_hours_details" {...fieldProps} />
                        <Field label="Break During Work" name="break_hours" {...fieldProps} />
                        <Field label="Working Hours Per Day (Total)" name="working_hours_per_day" type="number" {...fieldProps} />
                        <Field label="Number of Working Days Per Week" name="working_days_per_week" type="number" {...fieldProps} />
                        <Field label="Rest Day" name="rest_day" options={['Sunday', 'Saturday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']} {...fieldProps} />
                    </div>
                </div>

                {/* Salary */}
                <div className="card-base p-6">
                    <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 pb-3 border-b border-[var(--border-main)]">💰 Section C | Salary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Salary Period" name="salary_period" options={['Monthly', 'Weekly', 'Daily', 'Hourly']} {...fieldProps} />
                        <Field label="Date(s) of Salary Payment" name="salary_payment_date" {...fieldProps} />
                        <div />
                        <Field label="Overtime Payment Period" name="overtime_payment_period" {...fieldProps} />
                        <Field label="Date(s) of Overtime Payment" name="overtime_payment_date" {...fieldProps} />
                        <div />
                        <Field label="Basic Rate of Pay" name="basic_salary" type="currency" {...fieldProps} />
                        <Field label="Gross Rate of Pay" name="gross_rate_of_pay" type="currency" {...fieldProps} />
                        <Field label="Overtime Rate of Pay" name="overtime_rate" type="currency" {...fieldProps} />
                        <Field label="Other Salary-Related Components" name="other_salary_components" span2 {...fieldProps} />
                        <Field label="CPF contributions payable" name="cpf_payable" type="checkbox" {...fieldProps} />
                    </div>
                    <div className="mt-4 pt-4 border-t border-[var(--border-main)] grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field
                            label="Transport Allowance"
                            value={form.fixed_allowances?.transport}
                            onChange={v => setForm({ ...form, fixed_allowances: { ...form.fixed_allowances, transport: v } })}
                            type="currency"
                            {...fieldProps}
                        />
                        <Field
                            label="Meal Allowance"
                            value={form.fixed_allowances?.meal}
                            onChange={v => setForm({ ...form, fixed_allowances: { ...form.fixed_allowances, meal: v } })}
                            type="currency"
                            {...fieldProps}
                        />
                        <div className="flex items-end pb-2">
                            <p className="text-xs text-[var(--text-muted)]">Fixed Deductions: <span className="text-[var(--text-main)]">{formatCurrency(Object.values(deductions).reduce((a, b) => a + Number(b), 0))}</span></p>
                        </div>
                    </div>
                </div>

                {/* Leave & Medical Benefits */}
                <div className="card-base p-6">
                    <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 pb-3 border-b border-[var(--border-main)]">🌴 Section D | Leave and Medical Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Annual Leave (days)" name="annual_leave_days" type="number" {...fieldProps} />
                        <Field label="Outpatient Sick Leave (days)" name="sick_leave_days" type="number" {...fieldProps} />
                        <Field label="Hospitalization Leave (days)" name="hospitalization_days" type="number" {...fieldProps} />
                        <Field label="Medical Benefits" name="medical_benefits" span2 {...fieldProps} />
                    </div>
                    <div className="mt-4 pt-4 border-t border-[var(--border-main)] grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Field label="Maternity Leave (weeks)" name="maternity_weeks" type="number" {...fieldProps} />
                        <Field label="Paternity Leave (weeks)" name="paternity_weeks" type="number" {...fieldProps} />
                        <Field label="Childcare Leave (days)" name="childcare_days" type="number" {...fieldProps} />
                    </div>
                </div>

                {/* Others */}
                <div className="card-base p-6">
                    <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 pb-3 border-b border-[var(--border-main)]">📄 Section E | Others</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Length of Probation (months)" name="probation_months" type="number" {...fieldProps} />
                        <Field label="Probation Start Date" name="probation_start_date" type="date" {...fieldProps} />
                        <Field label="Probation End Date" name="probation_end_date" type="date" {...fieldProps} />
                        <Field label="Notice Period for Termination" name="notice_period" span2 {...fieldProps} />
                    </div>
                </div>
            </div>

            {/* MOM Compliance Note */}
            <div className="card-base p-4 border-[var(--brand-primary)]/30 bg-cyan-500/5">
                <p className="text-xs text-cyan-300 font-medium mb-1">📋 MOM Compliance Note</p>
                <p className="text-xs text-[var(--text-muted)]">This document contains all mandatory fields as required by the Ministry of Manpower (MOM) for Key Employment Terms under the Employment Act. KETs must be issued within 14 days of the employee's start date.</p>
            </div>
        </div >
    )
}
