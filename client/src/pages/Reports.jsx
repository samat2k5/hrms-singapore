import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatMonth } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
import { Printer, Eye, Download, FileText, LayoutDashboard, Landmark, Users, ClipboardList, ShieldAlert, BadgeAlert, FileCheck, ReceiptText, ArrowLeft, MoreHorizontal } from 'lucide-react'
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
    const [tab, setTab] = useState(null)
    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [selectedEmp, setSelectedEmp] = useState(null)
    const [employees, setEmployees] = useState([])
    const [attEmployeeId, setAttEmployeeId] = useState('')
    const [bikModal, setBikModal] = useState(false)
    const [shareModal, setShareModal] = useState(false)
    const [bikData, setBikData] = useState([])
    const [shareData, setShareData] = useState([])
    const [isViewerOpen, setIsViewerOpen] = useState(false)
    const [viewerPdfUrl, setViewerPdfUrl] = useState('')
    const [viewerTitle, setViewerTitle] = useState('')
    const tabs = [
        { key: 'summary', label: 'Payroll Summary', desc: 'Entity-wide payroll totals & stats', icon: LayoutDashboard, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { key: 'consolidated', label: 'Consolidated', desc: 'Grouping by employee group', icon: Landmark, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { key: 'detail', label: 'Payroll Detail', desc: 'Itemized drill-down breakdown', icon: ReceiptText, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { key: 'master', label: 'Employee Master', desc: 'Comprehensive employee database', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { key: 'expiry', label: 'Doc Expiry', desc: 'WP & Passport tracking', icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { key: 'cpf', label: 'CPF Submission', desc: 'Monthly CPF contribution', icon: Landmark, color: 'text-rose-400', bg: 'bg-rose-500/10' },
        { key: 'sdl', label: 'SDL Report', desc: 'Skills Development Levy', icon: FileCheck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        { key: 'shg', label: 'SHG Report', desc: 'Self-Help Group deductions', icon: ClipboardList, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { key: 'ir8a', label: 'IR8A Summary', desc: 'Annual IRAS tax reporting', icon: BadgeAlert, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
        { key: 'attendance', label: 'Detailed Attendance', desc: 'Monthly day-by-day timesheet', icon: ClipboardList, color: 'text-sky-400', bg: 'bg-sky-500/10' },
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
                case 'attendance':
                    if (!attEmployeeId) throw new Error("Please select an employee");
                    result = await api.getDetailedAttendance(year, month, attEmployeeId);
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
        if (tab === 'attendance') {
            api.getEmployees().then(setEmployees).catch(() => { });
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

                // Attendance Supplement (New Page)
                if (s.timesheets && s.timesheets.length > 0) {
                    doc.addPage();
                    doc.addImage(logo, 'PNG', 14, 10, 30, 15);
                    doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(6, 182, 212).text('DETAILED TIMESHEET ATTENDANCE', 105, 20, { align: 'center' });
                    doc.setFontSize(10).setFont(undefined, 'normal').setTextColor(100).text(`Supplement for Period: ${formatMonth(year, month)}`, 105, 26, { align: 'center' });

                    doc.setFontSize(10).setTextColor(0).text('Employee Details', 14, 40);
                    autoTable(doc, {
                        startY: 42,
                        body: [
                            ['Name', s.employee_name, 'Emp ID', s.emp_code],
                            ['Entity', s.entity_name, 'Group', s.employee_group || '-']
                        ],
                        theme: 'grid', styles: { fontSize: 8 }
                    });

                    const tsBody = s.timesheets.map(t => [
                        `${t.date.split('-')[2]} ${new Date(t.date).toLocaleString('default', { month: 'short' })} (${t.dayName.substring(0, 3)})`,
                        t.shift || '',
                        t.in_time || '',
                        t.out_time || '',
                        (t.normal_hours || '-'),
                        (t.ot_1_5_hours || '-'),
                        (t.ot_2_0_hours || '-'),
                        (t.ph_hours || '-'),
                        t.remarks || ''
                    ]);

                    const totals = s.timesheets.reduce((acc, t) => ({
                        normal: acc.normal + (parseFloat(t.normal_hours) || 0),
                        ot15: acc.ot15 + (parseFloat(t.ot_1_5_hours) || 0),
                        ot20: acc.ot20 + (parseFloat(t.ot_2_0_hours) || 0),
                        ph: acc.ph + (parseFloat(t.ph_hours) || 0)
                    }), { normal: 0, ot15: 0, ot20: 0, ph: 0 });

                    tsBody.push([
                        { content: 'MONTHLY TOTALS', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                        { content: totals.normal > 0 ? totals.normal.toFixed(1) : '-', styles: { fontStyle: 'bold', halign: 'center', fillColor: [224, 242, 254] } },
                        { content: totals.ot15 > 0 ? totals.ot15.toFixed(1) : '-', styles: { fontStyle: 'bold', halign: 'center', fillColor: [254, 243, 199] } },
                        { content: totals.ot20 > 0 ? totals.ot20.toFixed(1) : '-', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 237, 213] } },
                        { content: totals.ph > 0 ? totals.ph.toFixed(1) : '-', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 228, 230] } },
                        { content: '', styles: { fillColor: [240, 240, 240] } }
                    ]);

                    autoTable(doc, {
                        startY: doc.lastAutoTable.finalY + 10,
                        head: [['Date', 'Shift', 'In', 'Out', 'Basic', 'OT 1.5x', 'OT 2.0x', 'PH', 'Remarks']],
                        body: tsBody,
                        theme: 'striped',
                        styles: { fontSize: 7, halign: 'center' },
                        headStyles: { fillColor: [6, 182, 212], textColor: 255 },
                        columnStyles: {
                            0: { halign: 'left', cellWidth: 30 },
                            8: { halign: 'left' }
                        }
                    });

                    doc.setFontSize(7).setFont(undefined, 'normal').setTextColor(150);
                    doc.text('This supplement is an integral part of the payslip.', 105, 285, { align: 'center' });
                }
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
                    const displayAllowances = e.gross_pay - e.basic_salary;
                    masterBody.push([
                        { content: `${e.employee_name}\nID:${e.employee_code}`, styles: { ...summaryStyle, minCellHeight: mode === 'summary' ? 7 : 10 } },
                        { content: formatCurrency(e.basic_salary), styles: { ...summaryStyle, halign: 'right' } },
                        { content: formatCurrency(displayAllowances), styles: { ...summaryStyle, halign: 'right' } },
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
            } else if (tab === 'attendance' && data?.report) {
                headers = [['Date', 'Shift', 'In', 'Out', 'Basic', 'OT 1.5x', 'OT 2.0x', 'PH', 'Remarks']];
                tableData = data.report.map(r => [
                    `${r.date.split('-')[2]} ${new Date(r.date).toLocaleString('default', { month: 'short' })} (${r.dayName.substring(0, 3)})`,
                    r.shift,
                    r.clockIn,
                    r.clockOut,
                    r.normal_hours,
                    r.ot15,
                    r.ot20,
                    r.ph_hours,
                    r.remark
                ]);

                // Append Totals Row
                const totalBasic = data.report.reduce((sum, r) => sum + (parseFloat(r.normal_hours) || 0), 0);
                const totalOT15 = data.report.reduce((sum, r) => sum + (parseFloat(r.ot15) || 0), 0);
                const totalOT20 = data.report.reduce((sum, r) => sum + (parseFloat(r.ot20) || 0), 0);
                const totalPH = data.report.reduce((sum, r) => sum + (parseFloat(r.ph_hours) || 0), 0);

                tableData.push([
                    { content: 'MONTHLY TOTALS', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: totalBasic.toFixed(1), styles: { fontStyle: 'bold', halign: 'center', fillColor: [224, 242, 254] } }, // Light cyan
                    { content: totalOT15.toFixed(1), styles: { fontStyle: 'bold', halign: 'center', fillColor: [254, 243, 199] } }, // Light amber
                    { content: totalOT20.toFixed(1), styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 237, 213] } }, // Light orange
                    { content: totalPH.toFixed(1), styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 228, 230] } }, // Light rose
                    { content: '', styles: { fillColor: [240, 240, 240] } }
                ]);

                doc.setFontSize(12).setTextColor(0, 0, 0).setFont(undefined, 'bold');
                doc.text(`Employee Attendance Report: ${data.employee.full_name}`, 14, 34);
                doc.setFontSize(10).setFont(undefined, 'normal').setTextColor(100);
                doc.text(`ID: ${data.employee.employee_id} | Designation: ${data.employee.designation}`, 14, 40);
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

            doc.save(filename);
            toast.success(filename.includes('Grid') ? 'Professional Grid PDF downloaded' : 'PDF downloaded');
        } catch (err) {
            toast.error('Export failed')
        }
    }

    const activeTab = tabs.find(t => t.key === tab);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {tab && (
                        <button
                            onClick={() => { setTab(null); setData(null); }}
                            className="p-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-xl transition-all border border-[var(--border-main)]"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
                            {tab ? activeTab.label : 'Business Intelligence'}
                        </h1>
                        <p className="text-[var(--text-muted)] mt-0.5">
                            {tab ? activeTab.desc : 'Strategic insights and statutory reporting'}
                        </p>
                    </div>
                </div>

                {!tab && (
                    <div className="flex gap-2">
                        <button onClick={handleExportExcel} disabled={!data} className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/20 transition-all flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Excel Master
                        </button>
                    </div>
                )}
            </div>

            <ReportViewer
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                pdfUrl={viewerPdfUrl}
                title={viewerTitle}
            />

            {!tab ? (
                /* Report Selection Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-slide-up">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className="group relative flex flex-col p-6 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2rem] hover:border-[var(--brand-primary)]/40 hover:shadow-xl hover:shadow-[var(--brand-primary)]/5 transition-all duration-300 text-left overflow-hidden backdrop-blur-sm"
                            >
                                <div className={`w-14 h-14 ${t.bg} rounded-2xl flex items-center justify-center mb-4 border border-black/5 dark:border-white/5 group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`w-7 h-7 ${t.color}`} />
                                </div>
                                <h3 className="text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">{t.label}</h3>
                                <p className="text-[var(--text-muted)] text-sm mt-1 leading-relaxed">{t.desc}</p>

                                <div className="mt-8 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors text-opacity-60">Generate Report</span>
                                    <div className="w-8 h-8 rounded-full bg-[var(--bg-input)] flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 border border-[var(--border-main)]">
                                        <ArrowLeft className="w-4 h-4 text-[var(--text-main)] rotate-180" />
                                    </div>
                                </div>

                                {/* Inner glow/gradient */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent rounded-bl-full pointer-events-none" />
                            </button>
                        );
                    })}
                </div>
            ) : (
                /* Active Report View */
                <div className="space-y-6 animate-slide-up">
                    {/* Controls */}
                    <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2rem] backdrop-blur-md shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-5 flex-wrap">
                            {tab === 'attendance' && (
                                <div className="w-full sm:w-auto">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Employee</label>
                                    <select
                                        value={attEmployeeId}
                                        onChange={e => setAttEmployeeId(e.target.value)}
                                        className="w-full sm:w-64 bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Employee</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
                                    </select>
                                </div>
                            )}
                            {!['ir8a', 'master', 'expiry'].includes(tab) && (
                                <div className="w-full sm:w-auto">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Month</label>
                                    <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full sm:w-48 bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer">
                                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                            )}
                            {!['master', 'expiry'].includes(tab) && (
                                <div className="w-full sm:w-auto">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Year</label>
                                    <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full sm:w-36 bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer">
                                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            )}
                            {!['master', 'expiry'].includes(tab) && (
                                <button onClick={fetchReport} disabled={loading} className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20">
                                    {loading ? 'Processing...' : 'Generate View'}
                                </button>
                            )}
                            {data && (
                                <div className="flex gap-2 w-full sm:w-auto">
                                    {tab === 'detail' ? (
                                        <>
                                            <div className="flex rounded-xl overflow-hidden border border-[var(--border-main)] shadow-sm bg-[var(--bg-input)]">
                                                <button onClick={() => handleExportPDF(false, 'full')} className="px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-bold transition-all border-r border-[var(--border-main)] flex items-center gap-2 hover:bg-[var(--bg-card)]">
                                                    <Download className="w-3.5 h-3.5" /> Detail PDF
                                                </button>
                                                <button onClick={() => handleExportPDF(true, 'full')} className="px-3 py-2.5 text-cyan-400 hover:bg-cyan-500/10 text-xs transition-all flex items-center gap-1">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <div className="flex rounded-xl overflow-hidden border border-emerald-500/30 shadow-sm bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                                                <button onClick={() => handleExportPDF(false, 'summary')} className="px-4 py-2.5 text-emerald-400 text-xs font-bold transition-all border-r border-emerald-500/20 flex items-center gap-2">
                                                    <Download className="w-3.5 h-3.5" /> Summary PDF
                                                </button>
                                                <button onClick={() => handleExportPDF(true, 'summary')} className="px-3 py-2.5 text-emerald-400 hover:bg-emerald-500/20 text-xs transition-all flex items-center gap-1">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleExportPDF(false)} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] text-xs font-bold transition-all flex items-center justify-center gap-2">
                                                <Download className="w-4 h-4" /> Download PDF
                                            </button>
                                            <button onClick={() => handleExportPDF(true)} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 text-xs font-bold transition-all flex items-center justify-center gap-2">
                                                <Eye className="w-4 h-4" /> Preview
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Report Content */}
                    {loading && <div className="h-48 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500"></div></div>}

                    {data && !loading && (
                        <div className="p-1 animate-slide-up">
                            {tab === 'summary' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[
                                        { label: 'Total Headcount', val: data.headcount, color: 'text-[var(--text-main)]' },
                                        { label: 'Total Gross Pay', val: formatCurrency(data.total_gross), color: 'text-cyan-400' },
                                        { label: 'Total Net Pay', val: formatCurrency(data.total_net), color: 'text-emerald-400' },
                                        { label: 'Basic Salary', val: formatCurrency(data.total_basic), color: 'text-[var(--text-muted)]' },
                                        { label: 'Overtime Pay', val: formatCurrency(data.total_ot), color: 'text-amber-400' },
                                        { label: 'Standard Deductions', val: `-${formatCurrency(data.total_standard_deductions)}`, color: 'text-rose-400' },
                                        { label: 'CPF (Employer)', val: formatCurrency(data.total_cpf_er), color: 'text-blue-400' },
                                        { label: 'SDL Contribution', val: formatCurrency(data.total_sdl), color: 'text-indigo-400' },
                                        { label: 'SHG Fund', val: formatCurrency(data.total_shg), color: 'text-purple-400' },
                                    ].map((item, idx) => (
                                        <div key={idx} className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-[var(--brand-primary)]/30 transition-all shadow-sm">
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

                                                const displayAllowances = e.gross_pay - e.basic_salary;
                                                return (
                                                    <>
                                                        <tr key={i} className="cursor-pointer hover:bg-[var(--bg-input)]" onClick={() => setSelectedEmp(isExpanded ? null : e.employee_code)}>
                                                            <td className="text-center">{isExpanded ? '▼' : '▶'}</td>
                                                            <td className="text-[var(--text-main)] font-medium">{e.employee_name}</td>
                                                            <td>{e.employee_code}</td>
                                                            <td>{formatCurrency(e.basic_salary)}</td>
                                                            <td className="text-emerald-400">{formatCurrency(displayAllowances)}</td>
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

                            {tab === 'attendance' && data?.report && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-main)] backdrop-blur-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold border border-sky-500/30">
                                                {data.employee.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[var(--text-main)]">{data.employee.full_name}</h4>
                                                <p className="text-xs text-[var(--text-muted)] tracking-wide uppercase">{data.employee.designation} • {data.employee.employee_id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Base Pay</p>
                                            <p className="text-lg font-bold text-sky-400">{formatCurrency(data.employee.basic_salary)}</p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--border-main)] shadow-inner bg-[var(--bg-input)]/30 backdrop-blur-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-card)]/50">
                                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Date</th>
                                                    <th className="px-2 py-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">Shift</th>
                                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">In</th>
                                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">Out</th>
                                                    <th className="px-3 py-4 text-xs font-bold uppercase tracking-wider text-sky-400 text-center">Basic</th>
                                                    <th className="px-3 py-4 text-xs font-bold uppercase tracking-wider text-amber-400 text-center">OT 1.5</th>
                                                    <th className="px-3 py-4 text-xs font-bold uppercase tracking-wider text-orange-400 text-center">OT 2.0</th>
                                                    <th className="px-3 py-4 text-xs font-bold uppercase tracking-wider text-rose-400 text-center">PH</th>
                                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--border-main)]/50">
                                                {data.report.map((r, i) => (
                                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-5 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-[var(--text-main)]">{r.date.split('-')[2]} {new Date(r.date).toLocaleString('default', { month: 'short' })}</span>
                                                                <span className="text-[10px] uppercase tracking-tighter text-[var(--text-muted)]">{r.dayName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-3 text-center text-xs text-[var(--text-muted)]">{r.shift}</td>
                                                        <td className="px-4 py-3 text-center font-mono text-xs text-[var(--text-main)]">{r.clockIn}</td>
                                                        <td className="px-4 py-3 text-center font-mono text-xs text-[var(--text-main)]">{r.clockOut}</td>
                                                        <td className="px-3 py-3 text-center font-mono text-xs text-sky-400">{r.normal_hours}</td>
                                                        <td className="px-3 py-3 text-center font-mono text-xs text-amber-400">{r.ot15}</td>
                                                        <td className="px-3 py-3 text-center font-mono text-xs text-orange-400">{r.ot20}</td>
                                                        <td className="px-3 py-3 text-center font-mono text-xs text-rose-400">{r.ph_hours}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${r.remark === 'Rest Day' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                                                r.remark === 'AWOL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                                    r.remark.includes('Holiday') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                                        r.remark.includes('Leave') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                                            'text-[var(--text-muted)]'
                                                                }`}>
                                                                {r.remark}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-[var(--bg-card)]/50 border-t border-[var(--border-main)] font-bold">
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-4 text-right text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">Monthly Totals:</td>
                                                    <td className="px-3 py-4 text-center font-mono text-sm text-sky-400">
                                                        {data.report.reduce((sum, r) => sum + (parseFloat(r.normal_hours) || 0), 0).toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-4 text-center font-mono text-sm text-amber-400">
                                                        {data.report.reduce((sum, r) => sum + (parseFloat(r.ot15) || 0), 0).toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-4 text-center font-mono text-sm text-orange-400">
                                                        {data.report.reduce((sum, r) => sum + (parseFloat(r.ot20) || 0), 0).toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-4 text-center font-mono text-sm text-rose-400">
                                                        {data.report.reduce((sum, r) => sum + (parseFloat(r.ph_hours) || 0), 0).toFixed(1)}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
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
            )}
        </div>
    )
}
