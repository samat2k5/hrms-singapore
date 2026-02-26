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

    // BIK / Shares modal
    const [bikModal, setBikModal] = useState(null); // { empId, empName }
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

    useEffect(() => {
        if (activeTab === 'forms') loadForms();
        if (activeTab === 'cessation') loadCessation();
    }, [activeTab, year, loadForms, loadCessation]);

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
    const handleExportAIS = async () => {
        try {
            setLoading(true);
            const payload = await api.exportAISJson(year);
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AIS_IR8A_${year}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('AIS JSON exported');
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
                    onClick={handleExportAIS}
                    disabled={loading || forms.length === 0}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                    📤 Export AIS JSON
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
                                        return (
                                            <tr key={form.id || i} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)]/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-[var(--text-main)]">{form.full_name}</td>
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
                                                    <a
                                                        href="https://www.iras.gov.sg/taxes/individual-income-tax/employers/understanding-the-tax-clearance-process"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1.5 text-xs font-bold bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors inline-block"
                                                    >
                                                        🔗 IRAS IR21 Guide
                                                    </a>
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
