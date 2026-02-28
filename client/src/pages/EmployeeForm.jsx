import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import api from '../services/api'
import DatePicker from '../components/DatePicker'

const emptyEmployee = {
    employee_id: '', full_name: '', date_of_birth: '', national_id: '', nationality: 'Singapore Citizen',
    tax_residency: 'Resident', race: 'Chinese', gender: 'Male', language: 'English', mobile_number: '', whatsapp_number: '', email: '', highest_education: '', designation: '', department: '', employee_group: 'General', employee_grade: '', site_id: '',
    date_joined: '', cessation_date: '', basic_salary: 0, transport_allowance: 0, meal_allowance: 0,
    other_allowance: 0, payment_mode: 'Bank Transfer', custom_allowances: '{}', custom_deductions: '{}',
    bank_name: '', bank_account: '', cpf_applicable: 0,
    pr_status_start_date: '', cpf_full_rate_agreed: 0,
    working_days_per_week: 5.5, rest_day: 'Sunday',
    working_hours_per_day: 8, working_hours_per_week: 44,
    status: 'Active', photo_url: null,
    other_deduction: 0,
    work_pass_type: '', work_pass_expiry: '',
    work_pass_no: '', work_pass_start_date: '',
    _parsedCustomAllowances: [], _parsedCustomDeductions: []
}

const Field = ({ label, name, type = 'text', options, required, span2, form, setForm, min, max }) => (
    <div className={span2 ? 'md:col-span-2' : ''}>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {options ? (
            <select value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} className="select-base" required={required}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        ) : (
            <input
                type={type}
                value={form[name] || ''}
                onChange={e => setForm({ ...form, [name]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                className="input-base"
                required={required}
                step={type === 'number' ? '0.01' : undefined}
            />
        )}
    </div>
)

export default function EmployeeForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { activeEntity } = useAuth()
    const isEditing = Boolean(id)
    const fileInputRef = useRef(null)

    const [loading, setLoading] = useState(isEditing)
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState(emptyEmployee)
    const [documents, setDocuments] = useState([])
    const [photoFile, setPhotoFile] = useState(null)
    const [photoPreview, setPhotoPreview] = useState(null)

    // Config data
    const [configDepartments, setConfigDepartments] = useState([])
    const [configGroups, setConfigGroups] = useState([])
    const [configGrades, setConfigGrades] = useState([])
    const [configSites, setConfigSites] = useState([])

    const [emailDomains, setEmailDomains] = useState([])

    useEffect(() => {
        if (!activeEntity) return;

        // Load config data
        Promise.all([
            api.getDepartments(),
            api.getEmployeeGroups(),
            api.getEmployeeGrades(),
            api.getSites()
        ]).then(([depts, grps, grads, sites]) => {
            setConfigDepartments(depts)
            setConfigGroups(grps)
            setConfigGrades(grads)
            setConfigSites(sites)
        }).catch(e => {
            console.error('Config load error:', e);
            toast.error('Failed to load configuration data: ' + e.message);
        })

        // Set email domains from active entity
        if (activeEntity?.email_domains) {
            const domains = activeEntity.email_domains.split(',').map(d => ({ domain: d.trim(), id: d.trim() }));
            setEmailDomains(domains);
        } else {
            // Default domains
            setEmailDomains([
                { domain: 'gmail.com', id: 'gmail' },
                { domain: 'hypex.com.sg', id: 'hypex' },
                { domain: 'yahoo.com', id: 'yahoo' },
                { domain: 'hotmail.com', id: 'hotmail' },
                { domain: 'outlook.com', id: 'outlook' }
            ]);
        }

        // Load employee data if editing
        if (isEditing) {
            api.getEmployee(id).then(emp => {
                let parsedAllowances = [], parsedDeductions = [];
                try {
                    if (emp.custom_allowances) {
                        const obj = JSON.parse(emp.custom_allowances);
                        parsedAllowances = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                    }
                    if (emp.custom_deductions) {
                        const obj = JSON.parse(emp.custom_deductions);
                        parsedDeductions = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
                    }
                } catch (e) { }
                setForm({ ...emp, _parsedCustomAllowances: parsedAllowances, _parsedCustomDeductions: parsedDeductions })

                if (emp.photo_url) {
                    setPhotoPreview(emp.photo_url)
                }
            }).catch(e => {
                toast.error('Failed to load employee: ' + e.message)
                navigate('/employees')
            }).finally(() => {
                setLoading(false)
            })
        }
    }, [id, isEditing, navigate])

    const handlePhotoChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setPhotoFile(file)
            setPhotoPreview(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const formData = new FormData();

            // Core identification fields
            formData.append('employee_id', form.employee_id || '');
            formData.append('full_name', form.full_name || '');

            // Basic & Personal
            formData.append('date_of_birth', form.date_of_birth || '');
            formData.append('national_id', form.national_id || '');
            formData.append('nationality', form.nationality || 'Singapore Citizen');
            formData.append('tax_residency', form.tax_residency || 'Resident');
            formData.append('race', form.race || 'Chinese');
            formData.append('gender', form.gender || 'Male');
            formData.append('language', form.language || 'English');
            formData.append('status', form.status || 'Active');
            formData.append('work_pass_type', form.work_pass_type || '');
            formData.append('work_pass_expiry', form.work_pass_expiry || '');
            formData.append('work_pass_no', form.work_pass_no || '');
            formData.append('work_pass_start_date', form.work_pass_start_date || '');

            // Contact
            formData.append('mobile_number', form.mobile_number || '');
            formData.append('whatsapp_number', form.whatsapp_number || '');
            formData.append('email', form.email || '');

            // Employment
            formData.append('highest_education', form.highest_education || '');
            formData.append('designation', form.designation || '');
            formData.append('department', form.department || '');
            formData.append('employee_group', form.employee_group || 'General');
            formData.append('employee_grade', form.employee_grade || '');
            formData.append('site_id', form.site_id || '');
            formData.append('date_joined', form.date_joined || '');
            formData.append('cessation_date', form.cessation_date || '');
            formData.append('working_days_per_week', form.working_days_per_week || 5.5);
            formData.append('rest_day', form.rest_day || 'Sunday');
            formData.append('working_hours_per_day', form.working_hours_per_day || 8);
            formData.append('working_hours_per_week', form.working_hours_per_week || 44);

            // Payroll
            formData.append('basic_salary', form.basic_salary || 0);
            formData.append('transport_allowance', form.transport_allowance || 0);
            formData.append('meal_allowance', form.meal_allowance || 0);
            formData.append('other_allowance', form.other_allowance || 0); // Accommodation Deduction
            formData.append('other_deduction', form.other_deduction || 0); // Other Deduction
            formData.append('payment_mode', form.payment_mode || 'Bank Transfer');
            formData.append('bank_name', form.bank_name || '');
            formData.append('bank_account', form.bank_account || '');
            formData.append('cpf_applicable', form.cpf_applicable);
            formData.append('pr_status_start_date', form.pr_status_start_date || '');
            formData.append('cpf_full_rate_agreed', form.cpf_full_rate_agreed);

            // Custom Mods
            const cAllowances = {};
            form._parsedCustomAllowances?.forEach(item => { if (item.key) cAllowances[item.key] = Number(item.value) || 0; });
            const cDeductions = {};
            form._parsedCustomDeductions?.forEach(item => { if (item.key) cDeductions[item.key] = Number(item.value) || 0; });
            formData.append('custom_allowances', JSON.stringify(cAllowances));
            formData.append('custom_deductions', JSON.stringify(cDeductions));

            // Photo
            if (photoFile) {
                formData.append('photo', photoFile);
            } else if (form.photo_url) {
                formData.append('photo_url', form.photo_url);
            }

            let savedEmployee = null;
            if (isEditing) {
                savedEmployee = await api.updateEmployee(id, formData)
                toast.success('Employee updated')
            } else {
                savedEmployee = await api.createEmployee(formData)
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
                    const docFormData = new FormData();
                    docFormData.append('employee_id', savedEmployee.id);
                    docFormData.append('document_type', doc.document_type);
                    docFormData.append('document_number', doc.document_number);
                    if (doc.issue_date) docFormData.append('issue_date', doc.issue_date);
                    if (doc.expiry_date) docFormData.append('expiry_date', doc.expiry_date);
                    if (doc.file) docFormData.append('file', doc.file);
                    return api.createDocument(docFormData);
                });
                await Promise.all(uploadPromises);
                toast.success(`Uploaded ${documents.length} documents successfully`);
            }

            navigate('/employees')
        } catch (err) {
            toast.error(err.message)
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/employees')} className="text-[var(--text-muted)] hover:text-[var(--text-main)] mb-1">← Back</button>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--text-main)]">Loading Employee...</h1>
                    </div>
                </div>
                <div className="card-base p-6 min-h-[400px] flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[var(--brand-primary)]/30 border-t-cyan-500 rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/employees')} className="p-2 -ml-2 rounded-xl hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Back to Employees">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--text-main)]">{isEditing ? 'Edit Employee' : 'Add New Employee'}</h1>
                        <p className="text-[var(--text-muted)] mt-1">{isEditing ? `Updating ${form.full_name}'s profile` : 'Create a new employee profile'}</p>
                    </div>
                </div>
            </div>

            <div className="card-base p-6 md:p-8">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Photo Upload Header Section */}
                    <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center mb-8 pb-8 border-b border-[var(--border-main)] relative">
                        <div
                            className="group relative w-40 h-40 rounded-full border-4 border-[var(--border-main)] overflow-hidden bg-[var(--bg-input)] cursor-pointer shadow-2xl transition-all hover:border-[var(--brand-primary)]"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
                                    <span className="text-4xl mb-2">👤</span>
                                    <span className="text-xs font-bold uppercase tracking-wider">Upload Photo</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-sm font-bold uppercase">{photoPreview ? 'Change Photo' : 'Upload'}</span>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                        <div className="mt-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--text-main)]">{form.full_name || 'New Employee'}</h3>
                            <p className="text-xs text-[var(--text-muted)] font-bold tracking-[0.2em] uppercase mt-1">Professional Identity Photo</p>
                        </div>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 border-b border-[var(--border-main)] pb-2 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--brand-primary)]">Basic Information</h3>
                    </div>

                    <Field form={form} setForm={setForm} label="Employee ID" name="employee_id" required />
                    <Field form={form} setForm={setForm} label="Full Name" name="full_name" required />
                    <Field form={form} setForm={setForm} label="Status" name="status" options={['Active', 'Inactive']} required />

                    <DatePicker label="Date of Birth" selected={form.date_of_birth} onChange={val => setForm({ ...form, date_of_birth: val })} required />
                    <Field form={form} setForm={setForm} label="Gender" name="gender" options={['Male', 'Female']} required />
                    <Field form={form} setForm={setForm} label="Race" name="race" options={['Chinese', 'Indian', 'Malay', 'Eurasian', 'Other']} required />

                    <Field form={form} setForm={setForm} label="Nationality" name="nationality" options={['Singapore Citizen', 'SPR', 'Foreigner']} required />
                    <Field form={form} setForm={setForm} label="National ID (NRIC/FIN)" name="national_id" required={['Singapore Citizen', 'SPR'].includes(form.nationality)} />
                    <Field form={form} setForm={setForm} label="Language" name="language" options={['English', 'Mandarin', 'Malay', 'Tamil', 'Bengali', 'Telugu', 'Hindi', 'Others']} required />

                    <Field form={form} setForm={setForm} label="Highest Education Attained" name="highest_education" options={['Primary', 'Secondary', 'O Level', 'A Level', 'Diploma', 'Bachelor Degree', 'Master Degree', 'Doctorate', 'Others']} required />

                    {form.nationality === 'Foreigner' && (
                        <>
                            <Field form={form} setForm={setForm} label="Work Pass Type" name="work_pass_type" options={['Employment Pass', 'S Pass', 'Work Permit', 'Dependent Pass (with LOC)', 'Other']} required />
                            <DatePicker label="Work Pass Expiry" selected={form.work_pass_expiry} onChange={val => setForm({ ...form, work_pass_expiry: val })} required />
                            <Field form={form} setForm={setForm} label="Work Pass No" name="work_pass_no" required />
                            <DatePicker label="Work Pass Start Date" selected={form.work_pass_start_date} onChange={val => setForm({ ...form, work_pass_start_date: val })} required />
                        </>
                    )}

                    {form.nationality === 'SPR' && (
                        <>
                            <DatePicker label="PR Status Start Date" selected={form.pr_status_start_date} onChange={val => setForm({ ...form, pr_status_start_date: val })} required />
                            <div className="flex items-end mb-2">
                                <div className="flex items-center gap-3 w-full p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                                    <input
                                        type="checkbox"
                                        checked={form.cpf_full_rate_agreed === 1}
                                        onChange={e => setForm({ ...form, cpf_full_rate_agreed: e.target.checked ? 1 : 0 })}
                                        className="w-5 h-5 rounded accent-cyan-500"
                                    />
                                    <label className="text-sm font-medium text-cyan-200 cursor-pointer" onClick={() => setForm({ ...form, cpf_full_rate_agreed: form.cpf_full_rate_agreed === 1 ? 0 : 1 })}>
                                        Full CPF Rate Agreed (Employer & Employee)
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="md:col-span-2 lg:col-span-3 border-b border-[var(--border-main)] pb-2 mt-4 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--brand-primary)]">Contact Information</h3>
                    </div>

                    <Field form={form} setForm={setForm} label="Mobile Number" name="mobile_number" type="tel" />

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">WhatsApp Number</label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                value={form.whatsapp_number || ''}
                                onChange={e => setForm({ ...form, whatsapp_number: e.target.value })}
                                className="input-base flex-1"
                            />
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, whatsapp_number: form.mobile_number })}
                                className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors text-sm whitespace-nowrap flex items-center gap-1.5"
                                title="Copy from Mobile"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Same as Mobile
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Email Address</label>
                        <input
                            type="email"
                            list="email-domains"
                            className="input-base w-full"
                            value={form.email || ''}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="employee@domain.com"
                        />
                        <datalist id="email-domains">
                            {form.email && !form.email.includes('@') && emailDomains.map(d => (
                                <option key={d.id} value={`${form.email}@${d.domain}`} />
                            ))}
                        </datalist>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 border-b border-[var(--border-main)] pb-2 mt-4 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--brand-primary)]">Employment Details</h3>
                    </div>

                    <DatePicker label="Date Joined" selected={form.date_joined} onChange={val => setForm({ ...form, date_joined: val })} required />
                    <DatePicker label="Cessation Date" selected={form.cessation_date} onChange={val => setForm({ ...form, cessation_date: val })} />
                    <Field form={form} setForm={setForm} label="Working Days Per Week" name="working_days_per_week" options={['3', '3.5', '4', '4.5', '5', '5.25 (Alternate Saturday Off)', '5.5', '6']} />
                    <Field form={form} setForm={setForm} label="Rest Day" name="rest_day" options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']} />
                    <Field form={form} setForm={setForm} label="Work Hours Per Day" name="working_hours_per_day" type="number" step="0.5" />
                    <Field form={form} setForm={setForm} label="Normal Work Hours Per Week" name="working_hours_per_week" type="number" step="0.5" />

                    {/* Dynamic Departments Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                            Department <span className="text-rose-500">*</span>
                        </label>
                        <select value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className="select-base" required>
                            <option value="">Select a Department...</option>
                            {configDepartments.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <Field form={form} setForm={setForm} label="Designation" name="designation" required />

                    {/* Dynamic Groups Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                            Employee Group <span className="text-rose-500">*</span>
                        </label>
                        <select value={form.employee_group || 'General'} onChange={e => setForm({ ...form, employee_group: e.target.value })} className="select-base" required>
                            {configGroups.map(g => (
                                <option key={g.id} value={g.name}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Dynamic Grades Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Employee Grade</label>
                        <select value={form.employee_grade || ''} onChange={e => setForm({ ...form, employee_grade: e.target.value })} className="select-base">
                            <option value="">No Grade</option>
                            {configGrades.map(g => (
                                <option key={g.id} value={g.name}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Dynamic Sites Dropdown */}
                    <div className="md:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Site Assignment</label>
                        <select value={form.site_id || ''} onChange={e => setForm({ ...form, site_id: e.target.value ? parseInt(e.target.value) : '' })} className="select-base border-amber-500/30 focus:border-amber-500">
                            <option value="">Headquarters / No Fixed Site</option>
                            {configSites.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.customer_name})</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 border-b border-[var(--border-main)] pb-2 mt-4 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--brand-primary)]">Payroll & Compensation</h3>
                    </div>

                    <Field form={form} setForm={setForm} label="Basic Salary (S$)" name="basic_salary" type="number" required />
                    <Field form={form} setForm={setForm} label="Payment Mode" name="payment_mode" options={['Bank Transfer', 'GIRO', 'Cash', 'Cheque']} required />
                    <Field form={form} setForm={setForm} label="Tax Residency" name="tax_residency" options={['Resident', 'Non-Resident']} required />

                    <Field form={form} setForm={setForm} label="Bank Name" name="bank_name" />
                    <Field form={form} setForm={setForm} label="Bank Account" name="bank_account" />

                    <div className="md:col-span-1">
                        <div className="h-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] transition-all">
                            <input type="checkbox" checked={form.cpf_applicable === 1} onChange={e => setForm({ ...form, cpf_applicable: e.target.checked ? 1 : 0 })} className="w-5 h-5 rounded accent-[var(--brand-primary)]" />
                            <label className="text-sm font-medium text-[var(--text-muted)] cursor-pointer leading-tight select-none" onClick={() => setForm({ ...form, cpf_applicable: form.cpf_applicable === 1 ? 0 : 1 })}>
                                CPF Applicable <br />
                                <span className="text-[10px] opacity-70">(Citizens & SPR)</span>
                            </label>
                        </div>
                    </div>

                    {/* MOM Rate Displays */}
                    <div className="md:col-span-2 lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20 shadow-sm backdrop-blur-sm">
                        <div>
                            <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Daily Basic Rate</p>
                            <p className="text-lg font-semibold text-[var(--info)]">
                                ${((12 * (form.basic_salary || 0)) / (52 * (parseFloat(form.working_days_per_week) || 5.5))).toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Hourly Basic Rate</p>
                            <p className="text-lg font-semibold text-[var(--info)]">
                                ${((12 * (form.basic_salary || 0)) / (52 * (form.working_hours_per_week || 44))).toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">1.5x OT Rate</p>
                            <p className="text-lg font-semibold text-[var(--success)]">
                                ${(((12 * (form.basic_salary || 0)) / (52 * (form.working_hours_per_week || 44))) * 1.5).toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">2.0x OT Rate</p>
                            <p className="text-lg font-semibold text-[var(--warning)]">
                                ${(((12 * (form.basic_salary || 0)) / (52 * (form.working_hours_per_week || 44))) * 2.0).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <Field form={form} setForm={setForm} label="Fixed Transport Allowance ($)" name="transport_allowance" type="number" />
                    <Field form={form} setForm={setForm} label="Fixed Allowance" name="meal_allowance" type="number" />
                    <Field form={form} setForm={setForm} label="Accommodation Deduction" name="other_allowance" type="number" />
                    <Field form={form} setForm={setForm} label="Other Deduction" name="other_deduction" type="number" />

                    <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="space-y-4">
                            <h4 className="text-md font-medium text-emerald-400">Custom Allowances</h4>
                            <div className="space-y-3 dark-scrollbar max-h-48 overflow-y-auto pr-2">
                                {form._parsedCustomAllowances.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <input type="text" placeholder="Name (e.g. Handphone)" value={item.key} onChange={e => {
                                            const newArr = [...form._parsedCustomAllowances];
                                            newArr[index].key = e.target.value;
                                            setForm({ ...form, _parsedCustomAllowances: newArr });
                                        }} className="input-base flex-1" />
                                        <input type="number" placeholder="Amount" value={item.value} onChange={e => {
                                            const newArr = [...form._parsedCustomAllowances];
                                            newArr[index].value = e.target.value;
                                            setForm({ ...form, _parsedCustomAllowances: newArr });
                                        }} className="input-base w-24 sm:w-32" />
                                        <button type="button" onClick={() => {
                                            const newArr = form._parsedCustomAllowances.filter((_, i) => i !== index);
                                            setForm({ ...form, _parsedCustomAllowances: newArr });
                                        }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">×</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setForm({ ...form, _parsedCustomAllowances: [...form._parsedCustomAllowances, { key: '', value: 0 }] })} className="w-full text-sm py-2 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors">+ Add Allowance</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-md font-medium text-orange-400">Custom Deductions</h4>
                            <div className="space-y-3 dark-scrollbar max-h-48 overflow-y-auto pr-2">
                                {form._parsedCustomDeductions.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <input type="text" placeholder="Name (e.g. Loan Repayment)" value={item.key} onChange={e => {
                                            const newArr = [...form._parsedCustomDeductions];
                                            newArr[index].key = e.target.value;
                                            setForm({ ...form, _parsedCustomDeductions: newArr });
                                        }} className="input-base flex-1" />
                                        <input type="number" placeholder="Amount" value={item.value} onChange={e => {
                                            const newArr = [...form._parsedCustomDeductions];
                                            newArr[index].value = e.target.value;
                                            setForm({ ...form, _parsedCustomDeductions: newArr });
                                        }} className="input-base w-24 sm:w-32" />
                                        <button type="button" onClick={() => {
                                            const newArr = form._parsedCustomDeductions.filter((_, i) => i !== index);
                                            setForm({ ...form, _parsedCustomDeductions: newArr });
                                        }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">×</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setForm({ ...form, _parsedCustomDeductions: [...form._parsedCustomDeductions, { key: '', value: 0 }] })} className="w-full text-sm py-2 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors">+ Add Deduction</button>
                            </div>
                        </div>
                    </div>

                    {/* Document Uploads only applicable for New Employees because existing employees have a dedicated tab for document management. */}
                    {!isEditing && (
                        <div className="md:col-span-2 lg:col-span-3 pt-6 border-t border-[var(--border-main)] mt-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-[var(--brand-primary)]">Initial ID Documents & Passes</h3>
                                <button
                                    type="button"
                                    onClick={() => setDocuments([...documents, { document_type: 'NRIC', document_number: '', issue_date: '', expiry_date: '', file: null }])}
                                    className="text-sm px-4 py-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 border border-[var(--brand-primary)]/30 transition-colors"
                                >
                                    + Attach Document
                                </button>
                            </div>

                            <div className="space-y-3">
                                {documents.map((doc, index) => (
                                    <div key={index} className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-800/30 border border-[var(--border-main)] relative group">
                                        <button
                                            type="button"
                                            onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                                            className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-slate-800 border border-red-500/50 text-red-400 flex items-center justify-center text-sm shadow-lg hover:bg-red-500/20 transition-colors opacity-0 xl:opacity-100 group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>

                                        <select
                                            value={doc.document_type}
                                            onChange={e => {
                                                const newDocs = [...documents];
                                                newDocs[index].document_type = e.target.value;
                                                setDocuments(newDocs);
                                            }}
                                            className="select-base w-32"
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
                                            className="input-base flex-1 min-w-[150px]"
                                        />

                                        <DatePicker
                                            selected={doc.issue_date}
                                            onChange={val => {
                                                const newDocs = [...documents];
                                                newDocs[index].issue_date = val;
                                                setDocuments(newDocs);
                                            }}
                                            placeholderText="Issue Date"
                                        />

                                        <DatePicker
                                            selected={doc.expiry_date}
                                            onChange={val => {
                                                const newDocs = [...documents];
                                                newDocs[index].expiry_date = val;
                                                setDocuments(newDocs);
                                            }}
                                            placeholderText="Expiry Date"
                                        />

                                        <div className="w-full xl:w-auto mt-2 xl:mt-0">
                                            <input
                                                type="file"
                                                onChange={e => {
                                                    const newDocs = [...documents];
                                                    newDocs[index].file = e.target.files[0];
                                                    setDocuments(newDocs);
                                                }}
                                                className="w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-[var(--brand-primary)]/30 file:text-sm file:font-medium file:bg-[var(--brand-primary)]/10 file:text-[var(--brand-primary)] hover:file:bg-cyan-500/20 file:cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {documents.length === 0 && (
                                    <div className="text-center py-6 border border-dashed border-[var(--border-main)] rounded-xl bg-white/[0.02]">
                                        <p className="text-[var(--text-muted)] text-sm">No initial documents attached.</p>
                                        <p className="text-[var(--text-muted)] text-xs mt-1">You can attach NRICs, passports, or valid passes here, or upload them later on the employee's Documents tab.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2 lg:col-span-3 pt-6 mt-4 border-t border-[var(--border-main)] flex items-center justify-end gap-4">
                        <button type="button" onClick={() => navigate('/employees')} className="px-6 py-3 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all font-medium">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="btn-primary px-8 py-3 text-base flex items-center gap-2">
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-[var(--border-main)] border-t-white rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                isEditing ? 'Save Changes' : 'Create Employee Profile'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
