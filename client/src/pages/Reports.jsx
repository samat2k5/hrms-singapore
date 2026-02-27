import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatMonth } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
import { Printer, Eye, Download, FileText } from 'lucide-react'
import ReportViewer from '../components/ReportViewer'

const loadLogo = (url) => {
    return new Promise((resolve) => {
        if (!url) return resolve('/ezyhr-logo.png');
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve('/ezyhr-logo.png');
        img.src = url;
    });
};

export default function Reports() {
    const { activeEntity } = useAuth()
    const [tab, setTab] = useState('summary')
    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [selectedEmp, setSelectedEmp] = useState(null)
    const [bikModal, setBikModal] = useState(false)
    const [shareModal, setShareModal] = useState(false)
    const [bikData, setBikData] = useState([])
    const [shareData, setShareData] = useState([])
    const [isViewerOpen, setIsViewerOpen] = useState(false)
    const [viewerPdfUrl, setViewerPdfUrl] = useState('')
    const [viewerTitle, setViewerTitle] = useState('')

    const tabs = [
        { key: 'summary', label: '📋 Payroll Summary', desc: 'Entity-wide payroll totals' },
        { key: 'consolidated', label: '🏢 Consolidated', desc: 'Grouping by employee group' },
        { key: 'detail', label: '📝 Payroll Detail', desc: 'Drill-down breakdown' },
        { key: 'master', label: '👤 Employee Master', desc: 'Comprehensive employee database' },
        { key: 'expiry', label: '⚠️ Doc Expiry', desc: 'WP & Passport tracking' },
        { key: 'cpf', label: '🏦 CPF Submission', desc: 'Monthly CPF contribution' },
        { key: 'sdl', label: '🎓 SDL Report', desc: 'Skills Development Levy' },
        { key: 'shg', label: '🤝 SHG Report', desc: 'Self-Help Group deductions' },
        { key: 'ir8a', label: '📊 IR8A Summary', desc: 'Annual IRAS tax report' },
    ]

    const fetchReport = async () => {
        setData(null)
        setLoading(true)
        try {
            let result
            switch (tab) {
                case 'summary': result = await api.getPayrollSummary(year, month); break;
                case 'consolidated': result = await api.getConsolidatedPayroll(year, month); break;
                case 'detail': result = await api.getPayrollDetail(year, month); break;
                case 'master': result = await api.getEmployeeMaster(); break;
                case 'expiry': result = await api.getDocExpiry(); break;
                case 'cpf': result = await api.getCPFReport(year, month); break;
                case 'sdl': result = await api.getSDLReport(year, month); break;
                case 'shg': result = await api.getSHGReport(year, month); break;
                case 'ir8a':
                    const summary = await api.getIR8AReport(year);
                    const forms = await api.getIRASForms(year).catch(() => []);
                    const logs = await api.getIRASLogs().catch(() => []);
                    const cessation = await api.getIRASCessation().catch(() => []);
                    const cpfExcess = await api.getIRASCpfExcess().catch(() => []);
                    result = { summary, forms, logs, cessation, cpfExcess, year };
                    break;
            }
            setData(result)
        } catch (err) {
            toast.error(err.message)
            setData(null)
        }
        setLoading(false)
    }

    useEffect(() => {
        setData(null);
        if (tab === 'master' || tab === 'expiry') {
            fetchReport();
        }
    }, [tab])

    const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i).toLocaleString('en-SG', { month: 'long' }) }))

    const handleExportExcel = () => {
        if (!data) return;
        const worksheet = XLSX.utils.json_to_sheet(Array.isArray(data) ? data : (data.employees || [data]));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${tab}_export_${year}_${month}.xlsx`);
        toast.success('Excel exported');
    }

    const handleExportMasterPDF = async (isSnapshot = false) => {
        setLoading(true);
        try {
            // Find a run for this month to get all payslips
            const runs = await api.getPayrollRuns();
            const run = runs.find(r => r.period_year === year && r.period_month === month);

            if (!run) {
                toast.error(`No payroll run found for ${month}/${year}`);
                setLoading(false);
                return;
            }

            const slips = await api.getRunPayslips(run.id);
            if (!slips.length) throw new Error("No payslips found in this run");

            const jspdfModule = await import('jspdf');
            const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
            const autotableModule = await import('jspdf-autotable');
            const autoTable = autotableModule.default || autotableModule;

            const doc = new jsPDF();
            const logo = await loadLogo(activeEntity?.logo_url);

            slips.forEach((s, index) => {
                if (index > 0) doc.addPage();

                // Header
                doc.addImage(logo, 'PNG', 14, 10, 30, 15);
                doc.setFontSize(16).setFont(undefined, 'bold').text('ITEMIZED PAYSLIP', 105, 20, { align: 'center' });
                doc.setFontSize(10).setFont(undefined, 'normal').text(`Period: ${formatMonth(year, month)}`, 105, 26, { align: 'center' });

                // Employee Info
                doc.text('Employee Details', 14, 40);
                autoTable(doc, {
                    startY: 42,
                    body: [
                        ['Name', s.employee_name, 'Emp ID', s.emp_code],
                        ['Entity', s.entity_name, 'Payment Date', s.payment_date || '-']
                    ],
                    theme: 'grid', styles: { fontSize: 8 }
                });

                // Earnings & Deductions
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [['Earnings', 'Amount (S$)', 'Deductions', 'Amount (S$)']],
                    body: [
                        ['Basic Salary', formatCurrency(s.basic_salary), 'CPF (Employee)', formatCurrency(s.cpf_employee)],
                        ['Allowances', formatCurrency(s.total_allowances), 'SHG Deduction', formatCurrency(s.shg_deduction)],
                        ['Overtime Pay', formatCurrency(s.ot_1_5_pay + s.ot_2_0_pay + s.ph_worked_pay), 'Standard Deductions', formatCurrency(s.attendance_deduction + s.unpaid_leave_deduction + s.other_deduction)],
                        ['Performance Bonus', formatCurrency(s.performance_allowance), '', ''],
                        [{ content: 'Gross Pay', styles: { fontStyle: 'bold' } }, { content: formatCurrency(s.gross_pay), styles: { fontStyle: 'bold' } }, { content: 'Total Deductions', styles: { fontStyle: 'bold' } }, { content: formatCurrency(s.cpf_employee + s.shg_deduction + s.attendance_deduction + s.unpaid_leave_deduction + s.other_deduction), styles: { fontStyle: 'bold' } }]
                    ],
                    theme: 'striped', styles: { fontSize: 8 }
                });

                // Employer Contributions
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [['Employer Contributions', 'Amount (S$)']],
                    body: [
                        ['CPF (Employer)', formatCurrency(s.cpf_employer)],
                        ['SDL', formatCurrency(s.sdl)]
                    ],
                    theme: 'plain', styles: { fontSize: 8 }
                });

                // Net Pay Highlight
                const finalY = doc.lastAutoTable.finalY + 15;
                doc.setFontSize(12).setFont(undefined, 'bold').text(`NET PAY: ${formatCurrency(s.net_pay)}`, 196, finalY, { align: 'right' });

                // Footer
                doc.setFontSize(7).setFont(undefined, 'normal').setTextColor(150);
                doc.text('This is a computer-generated payslip. No signature required.', 105, 285, { align: 'center' });
            });

            if (isSnapshot) {
                const blob = doc.output('bloburl');
                setViewerPdfUrl(blob);
                setViewerTitle(`Master_Payslips_${activeEntity?.name}_${year}_${month}`);
                setIsViewerOpen(true);
                return;
            }

            doc.save(`Master_Payslips_${activeEntity?.name}_${year}_${month}.pdf`);
            toast.success('Master PDF generated');
        } catch (e) {
            toast.error(e.message);
        }
        setLoading(false);
    }

    const previewPDF = async (exportFn) => {
        setLoading(true);
        try {
            await exportFn(true);
        } catch (err) {
            toast.error('Preview failed');
        }
        setLoading(false);
    }

    const handleExportPDF = async (isSnapshot = false, mode = 'full') => {
        try {
            const jspdfModule = await import('jspdf');
            const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
            const autotableModule = await import('jspdf-autotable');
            const autoTable = autotableModule.default || autotableModule;

            const doc = new jsPDF()
            const logo = await loadLogo(activeEntity?.logo_url);
            doc.addImage(logo, 'PNG', 14, 10, 40, 20);

            doc.setFontSize(16).setTextColor(6, 182, 212)
            doc.text(tabs.find(t => t.key === tab).label.replace(/[^\w\s]/g, '').trim() + (mode === 'summary' ? ' (Summary)' : ''), 105, 20, { align: 'center' })

            doc.setFontSize(10).setTextColor(100)
            doc.text(tab === 'ir8a' ? `Year: ${year}` : `Period: ${formatMonth(year, month)}`, 105, 28, { align: 'center' })

            let tableData = []
            let headers = []

            if (tab === 'summary' && data) {
                headers = [['Description', 'Value']]
                tableData = [
                    ['Total Headcount', data.headcount],
                    ['Total Basic Salary', formatCurrency(data.total_basic)],
                    ['Total Allowances', formatCurrency(data.total_allowances)],
                    ['Total OT Pay', formatCurrency(data.total_ot)],
                    ['Total Gross Pay', formatCurrency(data.total_gross)],
                    ['Total CPF (Employee)', formatCurrency(data.total_cpf_ee)],
                    ['Total CPF (Employer)', formatCurrency(data.total_cpf_er)],
                    ['Total Deductions (Absence/Unpaid)', formatCurrency(data.total_standard_deductions)],
                    ['Total SDL', formatCurrency(data.total_sdl)],
                    ['Total SHG', formatCurrency(data.total_shg)],
                    ['Total Net Pay', formatCurrency(data.total_net)],
                ]
            } else if (tab === 'consolidated' && data?.groups) {
                headers = [['Group', 'Count', 'Gross', 'CPF (EE)', 'CPF (ER)', 'Net Pay']]
                tableData = data.groups.map(g => [g.employee_group, g.headcount, formatCurrency(g.total_gross), formatCurrency(g.total_cpf_ee), formatCurrency(g.total_cpf_er), formatCurrency(g.total_net)])
            } else if (tab === 'master' && Array.isArray(data)) {
                headers = [['ID', 'Name', 'Group', 'Basic', 'Bank', 'Account']]
                tableData = data.map(e => [e.employee_id, e.full_name, e.employee_group, formatCurrency(e.basic_salary), e.bank_name, e.bank_account])
            } else if (tab === 'expiry' && Array.isArray(data)) {
                headers = [['ID', 'Name', 'Nationality', 'Expiry (WP/PR)', 'Type']]
                tableData = data.map(e => [e.employee_id, e.full_name, e.nationality, e.cessation_date || e.pr_status_start_date || '-', e.cessation_date ? 'Work Permit' : 'PR Start'])
            } else if (tab === 'cpf' && data?.employees) {
                headers = [['Employee', 'ID', 'Gross Pay', 'CPF (EE)', 'CPF (ER)', 'OA', 'SA', 'MA']]
                tableData = data.employees.map(e => [e.employee_name, e.employee_code, formatCurrency(e.gross_pay), formatCurrency(e.cpf_employee), formatCurrency(e.cpf_employer), formatCurrency(e.cpf_oa), formatCurrency(e.cpf_sa), formatCurrency(e.cpf_ma)])
            } else if (tab === 'detail' && data?.employees) {
                const masterBody = [];
                data.employees.forEach((e) => {
                    const totalDeductions = e.cpf_employee + e.shg_deduction + e.attendance_deduction + e.unpaid_leave_deduction + e.other_deductions;
                    const customAllowances = e.custom_allowances ? JSON.parse(e.custom_allowances) : {};
                    const customDeductions = e.custom_deductions ? JSON.parse(e.custom_deductions) : {};

                    // 1. Summary Row (Yellow Background for full detail, White for summary grid)
                    const summaryStyle = { fontStyle: 'bold', fillColor: mode === 'summary' ? [255, 255, 255] : [255, 217, 102] };
                    masterBody.push([
                        { content: `${e.employee_name}\nID:${e.employee_code}`, styles: { ...summaryStyle, minCellHeight: mode === 'summary' ? 7 : 10 } },
                        { content: formatCurrency(e.basic_salary), styles: { ...summaryStyle, halign: 'right' } },
                        { content: formatCurrency(e.total_allowances), styles: { ...summaryStyle, halign: 'right' } },
                        { content: totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : formatCurrency(0), styles: { ...summaryStyle, halign: 'right' } },
                        { content: formatCurrency(e.net_pay), styles: { ...summaryStyle, halign: 'right' } },
                    ]);

                    if (mode === 'full') {
                        // 2. Section Headers Row (Light Green/Red Backgrounds)
                        masterBody.push([
                            '',
                            { content: 'EARNINGS BREAKDOWN', colSpan: 2, styles: { fillColor: [226, 240, 217], textColor: [16, 185, 129], fontStyle: 'bold', halign: 'center' } },
                            { content: 'DEDUCTIONS BREAKDOWN', colSpan: 2, styles: { fillColor: [252, 228, 214], textColor: [225, 29, 72], fontStyle: 'bold', halign: 'center' } }
                        ]);

                        // 3. Breakdown Items
                        const earnings = [
                            ['Basic Salary', formatCurrency(e.basic_salary)],
                            e.overtime_pay > 0 || true ? ['Overtime Pay', formatCurrency(e.overtime_pay)] : null, // Always show OT per sample
                            e.transport_allowance > 0 ? ['Transport Allowance', formatCurrency(e.transport_allowance)] : null,
                            e.meal_allowance > 0 ? ['Meal Allowance', formatCurrency(e.meal_allowance)] : null,
                            e.other_allowance > 0 ? ['Other Allowance', formatCurrency(e.other_allowance)] : null,
                            ...Object.entries(customAllowances).map(([name, val]) => [name, formatCurrency(val)]),
                            e.bonus > 0 ? ['Bonus / AWS', formatCurrency(e.bonus)] : null,
                            e.performance_allowance > 0 ? ['Performance Credit', formatCurrency(e.performance_allowance)] : null,
                            e.ns_makeup_pay > 0 ? ['NS Makeup Pay', formatCurrency(e.ns_makeup_pay)] : null,
                        ].filter(Boolean);

                        const deductions = [
                            e.cpf_employee > 0 ? ['CPF (Employee)', `-${formatCurrency(e.cpf_employee)}`] : null,
                            e.shg_deduction > 0 || true ? ['SHG Contribution', e.shg_deduction > 0 ? `-${formatCurrency(e.shg_deduction)}` : formatCurrency(0)] : null,
                            e.unpaid_leave_deduction > 0 ? ['Absence (Unpaid Leave)', `-${formatCurrency(e.unpaid_leave_deduction)}`] : null,
                            e.attendance_deduction > 0 ? ['Attendance Penalty', `-${formatCurrency(e.attendance_deduction)}`] : null,
                            ...Object.entries(customDeductions).map(([name, val]) => [name, `-${formatCurrency(val)}`]),
                            e.other_deductions > 0 ? ['Other Deductions', `-${formatCurrency(e.other_deductions)}`] : null,
                        ].filter(Boolean);

                        const maxRows = Math.max(earnings.length, deductions.length);
                        for (let i = 0; i < maxRows; i++) {
                            masterBody.push([
                                '',
                                earnings[i] ? earnings[i][0] : '',
                                earnings[i] ? { content: earnings[i][1], styles: { halign: 'right' } } : '',
                                deductions[i] ? deductions[i][0] : '',
                                deductions[i] ? { content: deductions[i][1], styles: { halign: 'right' } } : '',
                            ]);
                        }

                        // 4. Totals Row
                        masterBody.push([
                            '',
                            { content: 'Total Gross', styles: { fontStyle: 'bold' } },
                            { content: formatCurrency(e.gross_pay), styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
                            { content: totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : formatCurrency(0), styles: { fontStyle: 'bold', halign: 'right' } },
                        ]);
                    }
                });

                headers = [['Employee', 'Basic', 'Allowances', 'Deductions', 'Net Pay']];
                tableData = masterBody;

                autoTable(doc, {
                    startY: 35,
                    head: headers,
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
                    styles: { fontSize: 8, cellPadding: 1.0, overflow: 'linebreak', lineColor: [0, 0, 0], lineWidth: 0.1 },
                    columnStyles: {
                        0: { cellWidth: 70 },
                        1: { cellWidth: 30 },
                        2: { cellWidth: 30 },
                        3: { cellWidth: 30 },
                        4: { cellWidth: 30 },
                    }
                });

                if (isSnapshot) {
                    const blob = doc.output('bloburl');
                    setViewerPdfUrl(blob);
                    setViewerTitle(`Payroll_Detail_Report_${mode}_${year}_${month}`);
                    setIsViewerOpen(true);
                    return;
                }
                doc.save(`Payroll_Detail_Report_${mode}_${year}_${month}.pdf`);
                toast.success('Professional Grid PDF downloaded');
                return;
            }

            if (tableData.length) {
                autoTable(doc, {
                    startY: 35, head: headers, body: tableData, theme: 'grid',
                    headStyles: { fillColor: [6, 182, 212] }, styles: { fontSize: 8 }
                })
            }

            if (isSnapshot) {
                const blob = doc.output('bloburl');
                setViewerPdfUrl(blob);
                setViewerTitle(`${tab}_report_${year}_${month}`);
                setIsViewerOpen(true);
                return;
            }

            doc.save(`${tab}_report_${year}_${month}.pdf`)
            toast.success('PDF downloaded')
        } catch (err) {
            toast.error('Export failed')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Business Intelligence & Compliance</h1>
                    <p className="text-[var(--text-muted)] mt-1">Strategic insights and statutory reporting</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportExcel} disabled={!data} className="btn-primary bg-emerald-600 hover:bg-emerald-700 py-1.5 px-3 text-xs flex items-center gap-2">
                        <FileText className="w-3 h-3" /> Excel Master
                    </button>
                    <div className="flex rounded-xl overflow-hidden border border-rose-500/30">
                        <button onClick={() => handleExportMasterPDF(false)} disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white py-1.5 px-3 text-xs flex items-center gap-2 border-r border-rose-500/30 transition-colors">
                            <Download className="w-3 h-3" /> Master PDF
                        </button>
                        <button onClick={() => handleExportMasterPDF(true)} disabled={loading} className="bg-rose-900/50 hover:bg-rose-800 text-rose-300 py-1.5 px-3 text-xs flex items-center gap-2 transition-colors">
                            <Eye className="w-3 h-3" /> Preview
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-nowrap overflow-x-auto pb-2 scrollbar-none">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)] border border-transparent'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div className="card-base p-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
                    {!['ir8a', 'master', 'expiry'].includes(tab) && (
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm text-[var(--text-muted)] mb-1.5">Month</label>
                            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="select-base w-full sm:w-40">
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    )}
                    {!['master', 'expiry'].includes(tab) && (
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm text-[var(--text-muted)] mb-1.5">Year</label>
                            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="select-base w-full sm:w-32">
                                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}
                    {!['master', 'expiry'].includes(tab) && (
                        <button onClick={fetchReport} disabled={loading} className="btn-primary w-full sm:w-auto mt-2 sm:mt-0 text-center">
                            {loading ? 'Crunching...' : '📊 Generate'}
                        </button>
                    )}
                    {data && (
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            {tab === 'detail' ? (
                                <>
                                    <div className="flex rounded-xl overflow-hidden border border-[var(--border-main)] shadow-sm">
                                        <button onClick={() => handleExportPDF(false, 'full')} className="px-3 py-2.5 text-[var(--text-muted)] hover:bg-[var(--bg-input)] text-xs font-medium transition-all border-r border-[var(--border-main)] flex items-center gap-2">
                                            <Download className="w-3.5 h-3.5" /> Detail PDF
                                        </button>
                                        <button onClick={() => handleExportPDF(true, 'full')} className="px-2.5 py-2.5 text-cyan-400 hover:bg-cyan-500/10 text-xs transition-all flex items-center gap-1">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex rounded-xl overflow-hidden border border-emerald-500/30 shadow-sm bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                                        <button onClick={() => handleExportPDF(false, 'summary')} className="px-3 py-2.5 text-emerald-400 text-xs font-bold transition-all border-r border-emerald-500/20 flex items-center gap-2">
                                            <Download className="w-3.5 h-3.5" /> Summary PDF
                                        </button>
                                        <button onClick={() => handleExportPDF(true, 'summary')} className="px-2.5 py-2.5 text-emerald-400 hover:bg-emerald-500/20 text-xs transition-all flex items-center gap-1">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleExportPDF(false)} className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] text-sm transition-all flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" /> PDF
                                    </button>
                                    <button onClick={() => handleExportPDF(true)} className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-sm transition-all flex items-center justify-center gap-2">
                                        <Eye className="w-4 h-4" /> Preview
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ReportViewer
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                pdfUrl={viewerPdfUrl}
                title={viewerTitle}
            />

            {/* Report Content */}
            {loading && <div className="card-base h-48 loading-shimmer" />}

            {data && !loading && (
                <div className="card-base p-6 animate-slide-up">
                    {tab === 'summary' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                                { label: 'Total Headcount', val: data.headcount, color: 'text-white' },
                                { label: 'Total Gross Pay', val: formatCurrency(data.total_gross), color: 'text-cyan-400' },
                                { label: 'Total Net Pay', val: formatCurrency(data.total_net), color: 'text-emerald-400' },
                                { label: 'Basic Salary', val: formatCurrency(data.total_basic), color: 'text-[var(--text-muted)]' },
                                { label: 'Overtime Pay', val: formatCurrency(data.total_ot), color: 'text-amber-400' },
                                { label: 'Standard Deductions', val: `-${formatCurrency(data.total_standard_deductions)}`, color: 'text-rose-400' },
                                { label: 'CPF (Employer)', val: formatCurrency(data.total_cpf_er), color: 'text-blue-400' },
                                { label: 'SDL Contribution', val: formatCurrency(data.total_sdl), color: 'text-indigo-400' },
                                { label: 'SHG Fund', val: formatCurrency(data.total_shg), color: 'text-purple-400' },
                            ].map((item, idx) => (
                                <div key={idx} className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-main)] hover:border-[var(--brand-primary)]/30 transition-all">
                                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">{item.label}</p>
                                    <p className={`text-2xl font-bold ${item.color}`}>{item.val}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'consolidated' && (
                        <table className="table-theme">
                            <thead><tr><th>Employee Group</th><th>Headcount</th><th>Gross Pay</th><th>CPF (EE)</th><th>CPF (ER)</th><th>Net Pay</th></tr></thead>
                            <tbody>
                                {data.groups?.map((g, i) => (
                                    <tr key={i}>
                                        <td className="font-bold text-[var(--brand-primary)]">{g.employee_group}</td>
                                        <td>{g.headcount}</td>
                                        <td>{formatCurrency(g.total_gross)}</td>
                                        <td>{formatCurrency(g.total_cpf_ee)}</td>
                                        <td>{formatCurrency(g.total_cpf_er)}</td>
                                        <td className="font-bold">{formatCurrency(g.total_net)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {tab === 'master' && Array.isArray(data) && (
                        <div className="overflow-x-auto">
                            <table className="table-theme">
                                <thead><tr><th>Emp ID</th><th>Full Name</th><th>Group</th><th>Basic Pay</th><th>Bank</th><th>Account</th><th>Email</th></tr></thead>
                                <tbody>
                                    {data.map((e, i) => (
                                        <tr key={i}>
                                            <td>{e.employee_id}</td>
                                            <td className="text-[var(--text-main)]">{e.full_name}</td>
                                            <td><span className="badge-info">{e.employee_group}</span></td>
                                            <td>{formatCurrency(e.basic_salary)}</td>
                                            <td className="text-xs">{e.bank_name || '-'}</td>
                                            <td className="text-xs font-mono">{e.bank_account || '-'}</td>
                                            <td className="text-[10px]">{e.email || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'expiry' && Array.isArray(data) && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-sm">
                                <span>🔔 Showing documents expiring within 90 days or already expired.</span>
                            </div>
                            <table className="table-theme">
                                <thead><tr><th>Emp ID</th><th>Full Name</th><th>Nationality</th><th>Expiry Date</th><th>Document Type</th></tr></thead>
                                <tbody>
                                    {data.map((e, i) => {
                                        const isExpired = new Date(e.cessation_date || e.pr_status_start_date) < new Date();
                                        return (
                                            <tr key={i}>
                                                <td>{e.employee_id}</td>
                                                <td>{e.full_name}</td>
                                                <td>{e.nationality}</td>
                                                <td className={isExpired ? 'text-rose-500 font-bold' : 'text-amber-500'}>{e.cessation_date || e.pr_status_start_date || '-'}</td>
                                                <td><span className="badge-info">{e.cessation_date ? 'Work Permit' : 'PR Start'}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'cpf' && (
                        <table className="table-theme">
                            <thead><tr><th>Employee</th><th>ID</th><th>Gross</th><th>CPF (EE)</th><th>CPF (ER)</th><th>OA</th><th>SA</th><th>MA</th></tr></thead>
                            <tbody>
                                {data.employees?.map((e, i) => (
                                    <tr key={i}><td className="text-[var(--text-main)] font-medium">{e.employee_name}</td><td>{e.employee_code}</td><td>{formatCurrency(e.gross_pay)}</td><td>{formatCurrency(e.cpf_employee)}</td><td>{formatCurrency(e.cpf_employer)}</td><td>{formatCurrency(e.cpf_oa)}</td><td>{formatCurrency(e.cpf_sa)}</td><td>{formatCurrency(e.cpf_ma)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {tab === 'detail' && (
                        <div className="space-y-4">
                            <table className="table-theme">
                                <thead>
                                    <tr>
                                        <th className="w-10"></th>
                                        <th>Employee</th>
                                        <th>ID</th>
                                        <th>Basic</th>
                                        <th>Allowances</th>
                                        <th>Deductions</th>
                                        <th>Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.employees?.map((e, i) => {
                                        const isExpanded = selectedEmp === e.employee_code;
                                        const totalDeductions = e.cpf_employee + e.shg_deduction + e.attendance_deduction + e.unpaid_leave_deduction + e.other_deductions;
                                        const customAllowances = e.custom_allowances ? JSON.parse(e.custom_allowances) : {};
                                        const customDeductions = e.custom_deductions ? JSON.parse(e.custom_deductions) : {};

                                        return (
                                            <>
                                                <tr key={i} className="cursor-pointer hover:bg-[var(--bg-input)]" onClick={() => setSelectedEmp(isExpanded ? null : e.employee_code)}>
                                                    <td className="text-center">{isExpanded ? '▼' : '▶'}</td>
                                                    <td className="text-[var(--text-main)] font-medium">{e.employee_name}</td>
                                                    <td>{e.employee_code}</td>
                                                    <td>{formatCurrency(e.basic_salary)}</td>
                                                    <td className="text-emerald-400">{formatCurrency(e.total_allowances)}</td>
                                                    <td className="text-rose-400">-{formatCurrency(totalDeductions)}</td>
                                                    <td className="font-bold text-cyan-400">{formatCurrency(e.net_pay)}</td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-[var(--bg-card)]/50 border-x border-b border-[var(--border-main)]">
                                                        <td colSpan="7" className="p-6">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                {/* Allowances Drill-down */}
                                                                <div>
                                                                    <h4 className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-3 border-b border-[var(--border-main)] pb-1">Earnings breakdown</h4>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between text-sm"><span>Basic Salary</span><span className="font-mono">{formatCurrency(e.basic_salary)}</span></div>
                                                                        {e.transport_allowance > 0 && <div className="flex justify-between text-sm"><span>Transport Allowance</span><span className="font-mono">{formatCurrency(e.transport_allowance)}</span></div>}
                                                                        {e.meal_allowance > 0 && <div className="flex justify-between text-sm"><span>Meal Allowance</span><span className="font-mono">{formatCurrency(e.meal_allowance)}</span></div>}
                                                                        {e.other_allowance > 0 && <div className="flex justify-between text-sm"><span>Other Allowance</span><span className="font-mono">{formatCurrency(e.other_allowance)}</span></div>}
                                                                        {Object.entries(customAllowances).map(([name, val]) => (
                                                                            <div key={name} className="flex justify-between text-sm"><span>{name}</span><span className="font-mono">{formatCurrency(val)}</span></div>
                                                                        ))}
                                                                        {e.overtime_pay > 0 && <div className="flex justify-between text-sm text-cyan-400"><span>Overtime Pay</span><span className="font-mono">{formatCurrency(e.overtime_pay)}</span></div>}
                                                                        {e.bonus > 0 && <div className="flex justify-between text-sm text-amber-400 font-bold"><span>Bonus / AWS</span><span className="font-mono">{formatCurrency(e.bonus)}</span></div>}
                                                                        {e.performance_allowance > 0 && <div className="flex justify-between text-sm text-indigo-400"><span>Performance Credit</span><span className="font-mono">{formatCurrency(e.performance_allowance)}</span></div>}
                                                                        {e.ns_makeup_pay > 0 && <div className="flex justify-between text-sm"><span>NS Makeup Pay</span><span className="font-mono">{formatCurrency(e.ns_makeup_pay)}</span></div>}
                                                                        <div className="flex justify-between text-sm font-bold border-t border-[var(--border-main)] pt-2 text-white"><span>Total Gross</span><span className="font-mono">{formatCurrency(e.gross_pay)}</span></div>
                                                                    </div>
                                                                </div>

                                                                {/* Deductions Drill-down */}
                                                                <div>
                                                                    <h4 className="text-xs uppercase tracking-widest text-rose-400 font-bold mb-3 border-b border-[var(--border-main)] pb-1">Deductions breakdown</h4>
                                                                    <div className="space-y-2">
                                                                        {e.cpf_employee > 0 && <div className="flex justify-between text-sm"><span>CPF (Employee)</span><span className="font-mono">-{formatCurrency(e.cpf_employee)}</span></div>}
                                                                        {e.shg_deduction > 0 && <div className="flex justify-between text-sm"><span>SHG Contribution</span><span className="font-mono">-{formatCurrency(e.shg_deduction)}</span></div>}
                                                                        {e.unpaid_leave_deduction > 0 && <div className="flex justify-between text-sm text-rose-300"><span>Absence (Unpaid Leave)</span><span className="font-mono">-{formatCurrency(e.unpaid_leave_deduction)}</span></div>}
                                                                        {e.attendance_deduction > 0 && <div className="flex justify-between text-sm text-rose-300"><span>Attendance Penalty</span><span className="font-mono">-{formatCurrency(e.attendance_deduction)}</span></div>}
                                                                        {Object.entries(customDeductions).map(([name, val]) => (
                                                                            <div key={name} className="flex justify-between text-sm"><span>{name}</span><span className="font-mono">-{formatCurrency(val)}</span></div>
                                                                        ))}
                                                                        {e.other_deductions > 0 && <div className="flex justify-between text-sm"><span>Other Deductions</span><span className="font-mono">-{formatCurrency(e.other_deductions)}</span></div>}
                                                                        <div className="flex justify-between text-sm font-bold border-t border-[var(--border-main)] pt-2 text-white"><span>Total Deductions</span><span className="font-mono">-{formatCurrency(totalDeductions)}</span></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Keep existing IR8A/SDL/SHG logic as fallback but integrated into new design */}
                    {tab === 'ir8a' && (
                        <div className="space-y-4">
                            <p className="text-sm text-[var(--text-muted)]">Annual IRAS summary and form management.</p>
                            {/* Simplified view for clarity in this large update */}
                            <table className="table-theme">
                                <thead><tr><th>Employee</th><th>ID</th><th>Total Gross</th><th>Status</th></tr></thead>
                                <tbody>
                                    {data.forms?.map((f, i) => (
                                        <tr key={i}><td>{f.full_name}</td><td>{f.emp_code}</td><td>{formatCurrency(JSON.parse(f.data_json).income.gross_salary)}</td><td><span className="badge-success">{f.status}</span></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
