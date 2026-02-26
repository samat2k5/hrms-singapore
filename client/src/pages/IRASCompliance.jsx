import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

const currentYear = new Date().getFullYear();

export default function IRASCompliance() {
    const [activeTab, setActiveTab] = useState('forms');
    const [year, setYear] = useState(currentYear);
    const [forms, setForms] = useState([]);
    const [cessation, setCessation] = useState([]);
    const [loading, setLoading] = useState(false);
    const [validationResults, setValidationResults] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [readiness, setReadiness] = useState(null);
    const [nsClaims, setNsClaims] = useState([]);
    const [submissionModal, setSubmissionModal] = useState(null);

    // BIK / Shares modal
    const [bikModal, setBikModal] = useState(null); // { empId, empName }
    const [ir21Modal, setIr21Modal] = useState(null); // { empId, empName, draftData }
    const [bikList, setBikList] = useState([]);
    const [sharesList, setSharesList] = useState([]);
    const [bikForm, setBikForm] = useState({ category: '', description: '', value: '', period_from: '', period_to: '' });
    const [shareForm, setShareForm] = useState({ plan_type: '', grant_date: '', exercise_date: '', exercise_price: '', market_value: '', shares_count: '', taxable_profit: '' });

    const loadForms = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getIRASForms(year);
            setForms(Array.isArray(data) ? data : []);
        } catch { setForms([]); }
        setLoading(false);
    }, [year]);

    const loadCessation = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getIRASCessation();
            setCessation(Array.isArray(data) ? data : []);
        } catch { setCessation([]); }
        setLoading(false);
    }, []);

    const loadSubmissions = useCallback(async () => {
        try {
            const data = await api.getIRASSubmissionHistory(year);
            setSubmissions(Array.isArray(data) ? data : []);
        } catch { setSubmissions([]); }
    }, [year]);

    const loadReadiness = useCallback(async () => {
        try {
            const data = await api.getComplianceReadiness();
            setReadiness(data);
        } catch { setReadiness(null); }
    }, []);

    const loadNSClaims = useCallback(async () => {
        try {
            const data = await api.getNSClaims();
            setNsClaims(Array.isArray(data) ? data : []);
        } catch { setNsClaims([]); }
    }, []);

    useEffect(() => {
        if (activeTab === 'forms') {
            loadForms();
            setValidationResults([]);
            loadSubmissions();
        }
        if (activeTab === 'cessation') loadCessation();
        if (activeTab === 'submissions') loadSubmissions();
        if (activeTab === 'readiness') loadReadiness();
        if (activeTab === 'ns') loadNSClaims();
    }, [activeTab, year, loadForms, loadCessation, loadSubmissions, loadReadiness, loadNSClaims]);

    const handleValidate = async () => {
        setLoading(true);
        try {
            const results = await api.validateIRAS(year);
            setValidationResults(results);
            const totalErrors = results.reduce((acc, r) => acc + (r.errors?.length || 0), 0);
            if (totalErrors === 0) {
                toast.success('All forms passed pre-submission validation!');
            } else {
                toast.error(`Found ${totalErrors} issues across ${results.filter(r => r.errors?.length).length} forms.`);
            }
        } catch (err) {
            toast.error(err.message || 'Validation failed');
        }
        setLoading(false);
    };

    const handleSFFSSubmit = async () => {
        const totalErrors = validationResults.reduce((acc, r) => acc + (r.errors?.length || 0), 0);
        if (totalErrors > 0) {
            return Swal.fire({
                title: 'Validation Errors',
                text: `You have ${totalErrors} issues across your forms. Please fix them before submitting to IRAS.`,
                icon: 'error',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
            });
        }

        const auth = await Swal.fire({
            title: 'Authorize Submission',
            html: `You are about to submit <strong>${forms.length}</strong> records to IRAS.<br/><br/>This requires CorpPass Authorization.`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Authorize via CorpPass',
            confirmButtonColor: 'var(--brand-primary)',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
        });
        if (!auth.isConfirmed) return;

        try {
            setLoading(true);
            setSubmissionModal({ status: 'authorizing', message: 'Authenticating with GovTech APEX...' });

            // 1. Simulate Auth
            await new Promise(r => setTimeout(r, 1500));
            setSubmissionModal({ status: 'submitting', message: 'Transmitting JSON Payload (AIS-API 2.0)...' });

            // 2. Transmit
            const res = await api.submitIRASSFFS(year);
            setSubmissionModal({ status: 'pending', id: res.submissionId, message: res.message });

            // 3. Start Polling
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                const statusRes = await api.getIRASSubmissionStatus(res.submissionId);
                if (statusRes.status !== 'Pending' || attempts > 10) {
                    clearInterval(poll);
                    setSubmissionModal({
                        status: statusRes.status.toLowerCase(),
                        id: res.submissionId,
                        message: statusRes.status === 'Accepted' ? 'IRAS has accepted your filing.' : 'Submission was rejected by IRAS validation.'
                    });
                    loadSubmissions();
                }
            }, 2000);

        } catch (err) {
            toast.error(err.message || 'Submission failed');
            setSubmissionModal(null);
        }
        setLoading(false);
    };
    const handleDraftIR21 = async (empId, empName) => {
        setLoading(true);
        try {
            const draft = await api.draftIR21(empId);
            setIr21Modal({ empId, empName, draftData: draft });
        } catch (err) {
            toast.error(err.message || 'Failed to generate IR21 draft');
        }
        setLoading(false);
    };

    // Generate IR8A
    const handleGenerate = async () => {
        const result = await Swal.fire({
            title: `Generate IR8A for ${year}?`,
            html: `This will create IR8A forms for all eligible employees.<br/><small>Foreign workers with cessation dates will be excluded (IR21 required).</small>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Generate',
            confirmButtonColor: 'var(--brand-primary)',
            cancelButtonColor: '#6b7280',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
        });
        if (!result.isConfirmed) return;

        try {
            setLoading(true);
            const res = await api.generateIR8A(year);
            toast.success(res.message || 'IR8A forms generated');
            loadForms();
        } catch (err) {
            toast.error(err.message || 'Generation failed');
        }
        setLoading(false);
    };

    // Amend IR8A
    const handleAmend = async (empId, empName) => {
        const result = await Swal.fire({
            title: `Amend IR8A for ${empName}?`,
            text: `This will recalculate and create a new version for year ${year}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Amend',
            confirmButtonColor: '#f59e0b',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
        });
        if (!result.isConfirmed) return;

        try {
            const res = await api.amendIR8A(year, empId);
            if (res.requiresFormSG) {
                Swal.fire({
                    title: 'FormSG Required',
                    html: `Back-year amendments require submission via <a href="${res.formSgUrl}" target="_blank" class="text-cyan-400 underline">IRAS FormSG</a>.`,
                    icon: 'info',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                });
            } else {
                toast.success(res.message || 'Amendment created');
            }
            loadForms();
        } catch (err) {
            toast.error(err.message || 'Amendment failed');
        }
    };

    // Export AIS JSON
    const handleExportAIS = async (type = 'standard') => {
        try {
            setLoading(true);
            const payload = await api.exportAISJson(year);

            // If One-Stop, we might transform it, but for now we'll label it differently
            const filename = type === 'osp' ? `OSP_IRAS_${year}.json` : `AIS_IR8A_${year}.json`;

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(type === 'osp' ? 'One-Stop Payroll Export Ready' : 'AIS JSON exported');
        } catch (err) {
            toast.error(err.message || 'Export failed');
        }
        setLoading(false);
    };

    // BIK Modal
    const openBikModal = async (empId, empName) => {
        setBikModal({ empId, empName });
        setBikForm({ category: '', description: '', value: '', period_from: '', period_to: '' });
        setShareForm({ plan_type: '', grant_date: '', exercise_date: '', exercise_price: '', market_value: '', shares_count: '', taxable_profit: '' });
        try {
            const [biks, shares] = await Promise.all([
                api.getIRASBenefits(empId, year),
                api.getIRASShares(empId, year),
            ]);
            setBikList(Array.isArray(biks) ? biks : []);
            setSharesList(Array.isArray(shares) ? shares : []);
        } catch {
            setBikList([]);
            setSharesList([]);
        }
    };

    const handleAddBik = async () => {
        if (!bikForm.category || !bikForm.value) return toast.error('Category and value are required');
        try {
            await api.addIRASBenefit({ employee_id: bikModal.empId, year, ...bikForm, value: parseFloat(bikForm.value) });
            toast.success('Benefit added');
            const data = await api.getIRASBenefits(bikModal.empId, year);
            setBikList(Array.isArray(data) ? data : []);
            setBikForm({ category: '', description: '', value: '', period_from: '', period_to: '' });
        } catch (err) { toast.error(err.message); }
    };

    const handleDeleteBik = async (id) => {
        try {
            await api.deleteIRASBenefit(id);
            setBikList(prev => prev.filter(b => b.id !== id));
            toast.success('Deleted');
        } catch (err) { toast.error(err.message); }
    };

    const handleAddShare = async () => {
        if (!shareForm.plan_type) return toast.error('Plan type is required');
        try {
            await api.addIRASShare({
                employee_id: bikModal.empId, year, ...shareForm,
                exercise_price: parseFloat(shareForm.exercise_price) || 0,
                market_value: parseFloat(shareForm.market_value) || 0,
                shares_count: parseInt(shareForm.shares_count) || 0,
                taxable_profit: parseFloat(shareForm.taxable_profit) || 0,
            });
            toast.success('Share record added');
            const data = await api.getIRASShares(bikModal.empId, year);
            setSharesList(Array.isArray(data) ? data : []);
            setShareForm({ plan_type: '', grant_date: '', exercise_date: '', exercise_price: '', market_value: '', shares_count: '', taxable_profit: '' });
        } catch (err) { toast.error(err.message); }
    };

    const handleDeleteShare = async (id) => {
        try {
            await api.deleteIRASShare(id);
            setSharesList(prev => prev.filter(s => s.id !== id));
            toast.success('Deleted');
        } catch (err) { toast.error(err.message); }
    };

    const parseFormData = (form) => {
        try { return JSON.parse(form.data_json || '{}'); } catch { return {}; }
    };

    const fmtCurrency = (v) => v != null ? `$${Number(v).toLocaleString('en-SG', { minimumFractionDigits: 2 })}` : '-';

    const tabs = [
        { key: 'forms', label: '📋 IR8A Forms', desc: 'Generated tax forms' },
        { key: 'submissions', label: '🛰️ Submission History', desc: 'Direct API filing logs' },
        { key: 'readiness', label: '🛡️ Readiness', desc: 'Certification audit' },
        { key: 'ns', label: '🪖 NS Claims', desc: 'Reservist make-up pay' },
        { key: 'cessation', label: '🚪 Cessation/IR21', desc: 'Foreign worker cessations' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-card p-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-[var(--border-main)]">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
                            🏛️ IRAS Compliance Centre
                        </h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            IR8A Generation · Amendments · Benefits-in-Kind · AIS Export · Cessation Checks
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-[var(--text-muted)] font-medium">Year of Assessment</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                        >
                            {Array.from({ length: 6 }, (_, i) => currentYear - 4 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                    {loading ? '⏳ Processing...' : '⚡ Generate IR8A'}
                </button>
                <button
                    onClick={handleValidate}
                    disabled={loading || forms.length === 0}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
                >
                    🔍 Validate All
                </button>
                <div className="relative group">
                    <button
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
                        disabled={loading || forms.length === 0}
                    >
                        📤 Export Data <span className="text-[10px]">▼</span>
                    </button>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                        <button onClick={() => handleExportAIS('standard')} className="w-full text-left px-4 py-3 text-xs font-bold text-[var(--text-main)] hover:bg-[var(--bg-input)] transition-colors border-b border-[var(--border-main)]">Standard AIS JSON</button>
                        <button onClick={() => handleExportAIS('osp')} className="w-full text-left px-4 py-3 text-xs font-bold text-cyan-400 hover:bg-[var(--bg-input)] transition-colors">📦 One-Stop Payroll Export</button>
                    </div>
                </div>

                <div className="h-10 w-[1px] bg-[var(--border-main)] mx-2 hidden md:block" />

                <button
                    onClick={handleSFFSSubmit}
                    disabled={loading || forms.length === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600 text-white rounded-xl text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 border border-white/10"
                >
                    🚀 Authorize & Submit to IRAS
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-[var(--border-main)] pb-0">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${activeTab === tab.key
                            ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-card)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {loading && (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--brand-primary)]" />
                </div>
            )}

            {/* === FORMS TAB === */}
            {activeTab === 'forms' && !loading && (
                <div className="glass-card rounded-2xl border border-[var(--border-main)] overflow-hidden">
                    {forms.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">📄</div>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">No IR8A Forms Generated</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                Click "Generate IR8A" to create tax forms for all employees in {year}.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[var(--bg-input)] border-b border-[var(--border-main)]">
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Employee</th>
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Code</th>
                                        <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">Gross Pay</th>
                                        <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">CPF (EE)</th>
                                        <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">CPF (ER)</th>
                                        <th className="text-right px-4 py-3 font-semibold text-[var(--text-muted)]">Bonus</th>
                                        <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Status</th>
                                        <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Ver</th>
                                        <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {forms.map((form, i) => {
                                        const data = parseFormData(form);
                                        const validation = validationResults.find(v => v.employee_id === form.employee_id);
                                        const hasErrors = validation && validation.errors?.length > 0;

                                        return (
                                            <tr key={form.id || i} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)]/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-[var(--text-main)] flex items-center gap-2">
                                                        {form.full_name}
                                                        {hasErrors && (
                                                            <span className="group relative">
                                                                <span className="text-rose-500 cursor-help" title={validation.errors.join(', ')}>⚠️</span>
                                                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-rose-900/90 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
                                                                    <strong>Issues found:</strong>
                                                                    <ul className="list-disc ml-3 mt-1">
                                                                        {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                                                                    </ul>
                                                                </div>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-muted)]">{form.emp_code}</td>
                                                <td className="px-4 py-3 text-right font-mono">{fmtCurrency(data.gross_remuneration || data.total_gross)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{fmtCurrency(data.cpf_employee || data.total_cpf)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{fmtCurrency(data.cpf_employer || data.total_employer_cpf)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{fmtCurrency(data.bonus || data.total_bonus)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${form.status === 'Generated' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        form.status === 'Amended' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {form.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-mono text-[var(--text-muted)]">v{form.version}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleAmend(form.employee_id, form.full_name)}
                                                            className="px-3 py-1.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
                                                            title="Amend IR8A"
                                                        >
                                                            ✏️ Amend
                                                        </button>
                                                        <button
                                                            onClick={() => openBikModal(form.employee_id, form.full_name)}
                                                            className="px-3 py-1.5 text-xs font-bold bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                                                            title="Benefits & Shares"
                                                        >
                                                            🎁 BIK
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Summary Footer */}
                    {forms.length > 0 && (
                        <div className="p-4 bg-[var(--bg-input)] border-t border-[var(--border-main)] flex flex-wrap items-center justify-between gap-4">
                            <div className="text-sm text-[var(--text-muted)]">
                                <strong className="text-[var(--text-main)]">{forms.length}</strong> IR8A forms for YA {year}
                            </div>
                            <div className="text-sm text-[var(--text-muted)]">
                                Total Gross: <strong className="text-emerald-400 font-mono">
                                    {fmtCurrency(forms.reduce((sum, f) => {
                                        const d = parseFormData(f);
                                        return sum + (d.gross_remuneration || d.total_gross || 0);
                                    }, 0))}
                                </strong>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* === SUBMISSIONS TAB === */}
            {activeTab === 'submissions' && !loading && (
                <div className="glass-card rounded-2xl border border-[var(--border-main)] overflow-hidden">
                    {submissions.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">📡</div>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">No Direct Submissions</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                Forms submitted via "Authorize & Submit" will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[var(--bg-input)] border-b border-[var(--border-main)]">
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Submission ID</th>
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Type</th>
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">DateTime</th>
                                        <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Status</th>
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Response</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((sub, i) => {
                                        const response = JSON.parse(sub.response_json || '{}');
                                        return (
                                            <tr key={sub.id || i} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)]/50 transition-colors">
                                                <td className="px-4 py-3 font-mono font-bold text-cyan-400">{sub.submission_id}</td>
                                                <td className="px-4 py-3 text-[var(--text-muted)]">{sub.type}</td>
                                                <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(sub.timestamp).toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${sub.status === 'Accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        sub.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' :
                                                            'bg-blue-500/20 text-blue-400 animate-pulse'
                                                        }`}>
                                                        {sub.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs max-w-xs truncate text-[var(--text-muted)]">
                                                    {response.acknowledgment_no ? `ACK: ${response.acknowledgment_no}` : response.message || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* === SUBMISSION WORKFLOW MODAL === */}
            {submissionModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-card)] rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden relative">
                        {/* Animated Gradient Border */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

                        <div className="p-8 text-center space-y-6">
                            <div className="flex justify-center">
                                {submissionModal.status === 'authorizing' && (
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center text-2xl">🔐</div>
                                    </div>
                                )}
                                {submissionModal.status === 'submitting' && (
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center text-2xl">📡</div>
                                    </div>
                                )}
                                {submissionModal.status === 'pending' && (
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-pulse" />
                                        <div className="absolute inset-0 flex items-center justify-center text-2xl">⏳</div>
                                    </div>
                                )}
                                {submissionModal.status === 'accepted' && (
                                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-4xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                        ✅
                                    </div>
                                )}
                                {submissionModal.status === 'rejected' && (
                                    <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-4xl shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                                        ❌
                                    </div>
                                )}
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">
                                    {submissionModal.status === 'authorizing' ? 'CorpPass Authorization' :
                                        submissionModal.status === 'submitting' ? 'Transmitting Data' :
                                            submissionModal.status === 'pending' ? 'Processing at IRAS' :
                                                submissionModal.status === 'accepted' ? 'Filing Accepted' : 'Filing Rejected'}
                                </h2>
                                <p className="text-[var(--text-muted)] text-sm px-4">
                                    {submissionModal.message}
                                </p>
                            </div>

                            {submissionModal.id && (
                                <div className="p-3 bg-black/30 rounded-xl border border-white/5 font-mono text-[10px] text-cyan-400 inline-block overflow-hidden max-w-full">
                                    ID: {submissionModal.id}
                                </div>
                            )}

                            <div>
                                {(submissionModal.status === 'accepted' || submissionModal.status === 'rejected') ? (
                                    <button
                                        onClick={() => setSubmissionModal(null)}
                                        className="w-full py-3 bg-[var(--bg-input)] hover:bg-white/5 text-white rounded-xl font-bold border border-white/10 transition-all"
                                    >
                                        Close Portal
                                    </button>
                                ) : (
                                    <p className="text-[10px] text-[var(--text-muted)] italic animate-pulse">
                                        Please do not close this window during the operation...
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === READINESS TAB === */}
            {activeTab === 'readiness' && !loading && readiness && (
                <div className="space-y-6">
                    <div className="glass-card p-8 rounded-3xl border border-[var(--border-main)] flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">Compliance Readiness Score</h3>
                            <p className="text-[var(--text-muted)] text-sm">Diagnostic audit for official IRAS certification</p>
                        </div>
                        <div className="text-center">
                            <div className={`text-5xl font-black ${readiness.score >= 100 ? 'text-emerald-400' : readiness.score >= 80 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {readiness.score}%
                            </div>
                            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mt-1 tracking-widest">Global Status</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {readiness.checks.map((check, i) => (
                            <div key={i} className="glass-card p-5 rounded-2xl border border-[var(--border-main)] flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${check.status === 'Pass' ? 'bg-emerald-500/10 text-emerald-400' :
                                        check.status === 'Warning' ? 'bg-amber-500/10 text-amber-400' :
                                            'bg-rose-500/10 text-rose-400'
                                    }`}>
                                    {check.status === 'Pass' ? '✓' : check.status === 'Warning' ? '!' : '×'}
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{check.category}</div>
                                    <h4 className="text-sm font-bold text-white mt-1">{check.name}</h4>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{check.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* === NS CLAIMS TAB === */}
            {activeTab === 'ns' && !loading && (
                <div className="glass-card rounded-2xl border border-[var(--border-main)] overflow-hidden">
                    <div className="p-4 border-b border-[var(--border-main)] flex justify-between items-center bg-[var(--bg-input)]/30">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">NS Reservist Claims</h3>
                        <button
                            onClick={() => {
                                Swal.fire({
                                    title: 'Log NS Reservist Activity',
                                    html: `
                                        <select id="emp-select" class="swal2-input text-sm">
                                            <option value="">Select Employee</option>
                                            ${forms.map(f => `<option value="${f.employee_id}">${f.full_name}</option>`).join('')}
                                        </select>
                                        <input type="date" id="start-date" class="swal2-input" placeholder="Start Date">
                                        <input type="date" id="end-date" class="swal2-input" placeholder="End Date">
                                        <input type="number" id="ns-days" class="swal2-input" placeholder="Total Days">
                                    `,
                                    showCancelButton: true,
                                    confirmButtonText: 'Save Claim',
                                    background: 'var(--bg-main)',
                                    color: 'var(--text-main)',
                                    preConfirm: () => {
                                        return {
                                            employee_id: document.getElementById('emp-select').value,
                                            start_date: document.getElementById('start-date').value,
                                            end_date: document.getElementById('end-date').value,
                                            total_days: document.getElementById('ns-days').value,
                                            claim_amount: 0
                                        }
                                    }
                                }).then(async result => {
                                    if (result.isConfirmed) {
                                        await api.addNSClaim(result.value);
                                        toast.success('NS Claim logged');
                                        loadNSClaims();
                                    }
                                });
                            }}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-all uppercase tracking-widest"
                        >
                            + Log New Activity
                        </button>
                    </div>
                    {nsClaims.length === 0 ? (
                        <div className="p-12 text-center text-[var(--text-muted)] italic text-sm">No NS claims registered.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[var(--bg-input)] border-b border-[var(--border-main)]">
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Employee</th>
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Start Date</th>
                                        <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">End Date</th>
                                        <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Days</th>
                                        <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nsClaims.map(claim => (
                                        <tr key={claim.id} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)]/50 transition-colors">
                                            <td className="px-4 py-3 font-bold text-white">{claim.employee_name}</td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{claim.start_date}</td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{claim.end_date}</td>
                                            <td className="px-4 py-3 text-center font-mono text-cyan-400">{claim.total_days}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${claim.status === 'Reimbursed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                                    }`}>
                                                    {claim.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* === CESSATION TAB === */}
            {activeTab === 'cessation' && !loading && (
                <div className="glass-card rounded-2xl border border-[var(--border-main)] overflow-hidden">
                    {cessation.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">✅</div>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">No IR21 Required</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                No foreign employees with cessation dates found. IR21 filing is not required.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-amber-500/10 border-b border-amber-500/20">
                                <p className="text-sm text-amber-300 font-medium">
                                    ⚠️ The following foreign employees have cessation dates and may require IR21 filing with IRAS.
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[var(--bg-input)] border-b border-[var(--border-main)]">
                                            <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Employee</th>
                                            <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Employee ID</th>
                                            <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Nationality</th>
                                            <th className="text-left px-4 py-3 font-semibold text-[var(--text-muted)]">Cessation Date</th>
                                            <th className="text-center px-4 py-3 font-semibold text-[var(--text-muted)]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cessation.map((emp, i) => (
                                            <tr key={emp.id || i} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)]/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-[var(--text-main)]">{emp.full_name}</td>
                                                <td className="px-4 py-3 text-[var(--text-muted)]">{emp.employee_id}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400">
                                                        {emp.nationality}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-rose-400 font-medium">{emp.cessation_date}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleDraftIR21(emp.id, emp.full_name)}
                                                            className="px-3 py-1.5 text-xs font-bold bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                                                        >
                                                            📝 Draft IR21
                                                        </button>
                                                        <a
                                                            href="https://www.iras.gov.sg/taxes/individual-income-tax/employers/understanding-the-tax-clearance-process"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 text-xs font-bold bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors inline-block"
                                                        >
                                                            🔗 Guide
                                                        </a>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* === IR21 DRAFT MODAL === */}
            {ir21Modal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="p-6 border-b border-[var(--border-main)] flex items-center justify-between bg-gradient-to-r from-cyan-600/20 to-transparent">
                            <div>
                                <h2 className="text-lg font-bold text-[var(--text-main)]">📝 Tax Clearance (IR21) Draft</h2>
                                <p className="text-sm text-[var(--text-muted)]">{ir21Modal.empName}</p>
                            </div>
                            <button onClick={() => setIr21Modal(null)} className="text-[var(--text-muted)] hover:text-rose-400 text-2xl leading-none">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-main)]">
                                    <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Cessation Date</p>
                                    <p className="text-lg font-bold text-rose-400 font-mono">{ir21Modal.draftData?.employee_details?.cessation_date}</p>
                                </div>
                                <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-main)]">
                                    <p className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">Nationality</p>
                                    <p className="text-lg font-bold text-blue-400">{ir21Modal.draftData?.employee_details?.nationality}</p>
                                </div>
                            </div>

                            <div className="p-6 bg-cyan-900/10 border border-cyan-500/20 rounded-2xl">
                                <h3 className="text-sm font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">💰 YTD Income Aggregation ({ir21Modal.draftData?.income_summary?.year})</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[var(--text-muted)]">Gross Salary (YTD)</span>
                                        <span className="font-mono font-bold text-[var(--text-main)]">{fmtCurrency(ir21Modal.draftData?.income_summary?.gross_pay)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[var(--text-muted)]">Bonus (YTD)</span>
                                        <span className="font-mono font-bold text-[var(--text-main)]">{fmtCurrency(ir21Modal.draftData?.income_summary?.bonus)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-t border-[var(--border-main)] pt-3">
                                        <span className="text-[var(--text-main)] font-bold">Total Remuneration</span>
                                        <span className="font-mono font-bold text-emerald-400 text-lg">
                                            {fmtCurrency((ir21Modal.draftData?.income_summary?.gross_pay || 0) + (ir21Modal.draftData?.income_summary?.bonus || 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-bold shadow-lg hover:shadow-cyan-500/25 transition-all">Submit to IRAS via API (SFFS)</button>
                                <button onClick={() => setIr21Modal(null)} className="px-6 py-3 bg-[var(--bg-input)] text-[var(--text-muted)] rounded-xl font-bold border border-[var(--border-main)] hover:text-[var(--text-main)]">Close</button>
                            </div>
                            <p className="text-[10px] text-center text-[var(--text-muted)] italic">
                                Note: This draft consolidates all payroll records from Jan 1st to the cessation date.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* === BIK / SHARES MODAL === */}
            {bikModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBikModal(null)}>
                    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-[var(--border-main)] flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-[var(--text-main)]">🎁 Benefits & Share Options</h2>
                                <p className="text-sm text-[var(--text-muted)]">{bikModal.empName} · YA {year}</p>
                            </div>
                            <button onClick={() => setBikModal(null)} className="text-[var(--text-muted)] hover:text-rose-400 text-2xl leading-none">×</button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Benefits-in-Kind Section */}
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-main)] mb-3 uppercase tracking-wider">Benefits-in-Kind (Appendix 8A)</h3>
                                {bikList.length > 0 && (
                                    <div className="overflow-x-auto mb-3">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-[var(--bg-input)]">
                                                    <th className="text-left px-3 py-2">Category</th>
                                                    <th className="text-left px-3 py-2">Description</th>
                                                    <th className="text-right px-3 py-2">Value</th>
                                                    <th className="text-left px-3 py-2">Period</th>
                                                    <th className="text-center px-3 py-2">Del</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bikList.map(b => (
                                                    <tr key={b.id} className="border-b border-[var(--border-main)]">
                                                        <td className="px-3 py-2">{b.category}</td>
                                                        <td className="px-3 py-2">{b.description}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{fmtCurrency(b.value)}</td>
                                                        <td className="px-3 py-2">{b.period_from} — {b.period_to}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <button onClick={() => handleDeleteBik(b.id)} className="text-rose-400 hover:text-rose-300">🗑️</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <select value={bikForm.category} onChange={e => setBikForm(p => ({ ...p, category: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs">
                                        <option value="">Category</option>
                                        <option value="Housing">Housing</option>
                                        <option value="Car">Car</option>
                                        <option value="Utilities">Utilities</option>
                                        <option value="Driver">Driver</option>
                                        <option value="Household">Household</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <input placeholder="Description" value={bikForm.description} onChange={e => setBikForm(p => ({ ...p, description: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs" />
                                    <input placeholder="Value ($)" type="number" value={bikForm.value} onChange={e => setBikForm(p => ({ ...p, value: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs" />
                                    <input type="date" value={bikForm.period_from} onChange={e => setBikForm(p => ({ ...p, period_from: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs" />
                                    <button onClick={handleAddBik} className="px-3 py-2 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">+ Add</button>
                                </div>
                            </div>

                            {/* Share Options Section */}
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-main)] mb-3 uppercase tracking-wider">Share Options (Appendix 8B)</h3>
                                {sharesList.length > 0 && (
                                    <div className="overflow-x-auto mb-3">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-[var(--bg-input)]">
                                                    <th className="text-left px-3 py-2">Plan Type</th>
                                                    <th className="text-left px-3 py-2">Grant Date</th>
                                                    <th className="text-left px-3 py-2">Exercise Date</th>
                                                    <th className="text-right px-3 py-2">Shares</th>
                                                    <th className="text-right px-3 py-2">Taxable</th>
                                                    <th className="text-center px-3 py-2">Del</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sharesList.map(s => (
                                                    <tr key={s.id} className="border-b border-[var(--border-main)]">
                                                        <td className="px-3 py-2">{s.plan_type}</td>
                                                        <td className="px-3 py-2">{s.grant_date}</td>
                                                        <td className="px-3 py-2">{s.exercise_date}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{s.shares_count?.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{fmtCurrency(s.taxable_profit)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <button onClick={() => handleDeleteShare(s.id)} className="text-rose-400 hover:text-rose-300">🗑️</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <select value={shareForm.plan_type} onChange={e => setShareForm(p => ({ ...p, plan_type: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs">
                                        <option value="">Plan Type</option>
                                        <option value="ESOP">ESOP</option>
                                        <option value="ESOW">ESOW</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <input type="date" placeholder="Grant Date" value={shareForm.grant_date} onChange={e => setShareForm(p => ({ ...p, grant_date: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs" />
                                    <input type="number" placeholder="Shares" value={shareForm.shares_count} onChange={e => setShareForm(p => ({ ...p, shares_count: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-lg px-3 py-2 text-xs" />
                                    <button onClick={handleAddShare} className="px-3 py-2 text-xs font-bold bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors">+ Add</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
