import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatCurrency, formatDate, formatMonth } from '../utils/formatters'

export default function Payslip() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [payslip, setPayslip] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.getPayslip(id).then(setPayslip).catch(e => toast.error(e.message)).finally(() => setLoading(false))
    }, [id])

    const handleExportPDF = async () => {
        try {
            const { jsPDF } = await import('jspdf')
            const { default: autoTable } = await import('jspdf-autotable')

            const doc = new jsPDF()
            const ps = payslip

            // Header
            try {
                const img = new Image();
                img.src = '/ezyhr-logo.png';
                doc.addImage(img, 'PNG', 14, 10, 40, 20);
            } catch (e) {
                console.error('Logo failed to load for PDF', e);
            }

            doc.setFontSize(18)
            doc.setTextColor(6, 182, 212)
            doc.text('ITEMIZED PAYSLIP', 105, 20, { align: 'center' })

            doc.setFontSize(9)
            doc.setTextColor(100)
            doc.text('MOM Compliant — Employment Act', 105, 27, { align: 'center' })

            // Company & Employee Info
            doc.setFontSize(10)
            doc.setTextColor(0)
            let y = 40

            doc.setFont(undefined, 'bold')
            doc.text('Employer:', 14, y)
            doc.setFont(undefined, 'normal')
            doc.text(ps.entity_name || 'ezyHR Pte Ltd', 50, y)

            y += 7
            doc.setFont(undefined, 'bold')
            doc.text('Employee:', 14, y)
            doc.setFont(undefined, 'normal')
            doc.text(`${ps.employee_name} (${ps.employee_code})`, 50, y)

            y += 7
            doc.setFont(undefined, 'bold')
            doc.text('Pay Period:', 14, y)
            doc.setFont(undefined, 'normal')
            doc.text(formatMonth(ps.period_year, ps.period_month), 50, y)

            doc.setFont(undefined, 'bold')
            doc.text('Payment Mode:', 110, y)
            doc.setFont(undefined, 'normal')
            doc.text(ps.payment_mode || 'Bank Transfer', 145, y)

            y += 7
            doc.setFont(undefined, 'bold')
            doc.text('Payment Date:', 110, y)
            doc.setFont(undefined, 'normal')
            doc.text(ps.payment_date ? formatDate(ps.payment_date) : formatDate(ps.run_date), 145, y)

            y += 12

            const earningsRows = [
                ['Basic Salary', formatCurrency(ps.basic_salary)],
                ['Transport Allowance', formatCurrency(ps.transport_allowance)],
                ['Meal Allowance', formatCurrency(ps.meal_allowance)],
                ['Other Allowance', formatCurrency(ps.other_allowance)],
            ];

            try {
                if (ps.custom_allowances && ps.custom_allowances !== '{}') {
                    const ca = JSON.parse(ps.custom_allowances);
                    Object.entries(ca).forEach(([k, v]) => earningsRows.push([k, formatCurrency(v)]));
                }
            } catch (e) { }

            if (ps.ot_1_5_hours > 0) earningsRows.push([`Overtime 1.5x (${ps.ot_1_5_hours} hrs)`, formatCurrency(ps.ot_1_5_pay)]);
            if (ps.ot_2_0_hours > 0) earningsRows.push([`Overtime 2.0x (${ps.ot_2_0_hours} hrs)`, formatCurrency(ps.ot_2_0_pay)]);
            if (ps.overtime_hours > 0 && ps.ot_1_5_hours === 0 && ps.ot_2_0_hours === 0) earningsRows.push([`Overtime (${ps.overtime_hours} hrs)`, formatCurrency(ps.overtime_pay)]);

            if (ps.bonus > 0) earningsRows.push(['Bonus', formatCurrency(ps.bonus)]);
            if (ps.unpaid_leave_days > 0) earningsRows.push(['Unpaid Leave Deduction', `(${formatCurrency(ps.unpaid_leave_deduction)})`]);
            earningsRows.push([{ content: 'Gross Pay', styles: { fontStyle: 'bold' } }, { content: formatCurrency(ps.gross_pay), styles: { fontStyle: 'bold' } }]);

            // Earnings Table
            autoTable(doc, {
                startY: y,
                head: [['Earnings', 'Amount (S$)']],
                body: earningsRows,
                theme: 'grid',
                headStyles: { fillColor: [6, 182, 212] },
                styles: { fontSize: 9 },
            })

            y = doc.lastAutoTable.finalY + 10

            const deductionsRows = [
                ['CPF Employee Contribution', formatCurrency(ps.cpf_employee)],
                [`Self-Help Group (${ps.shg_fund || 'N/A'})`, formatCurrency(ps.shg_deduction)],
            ];

            let customDeductionsTotal = 0;
            try {
                if (ps.custom_deductions && ps.custom_deductions !== '{}') {
                    const cd = JSON.parse(ps.custom_deductions);
                    Object.entries(cd).forEach(([k, v]) => {
                        deductionsRows.push([k, formatCurrency(v)]);
                        customDeductionsTotal += Number(v);
                    });
                }
            } catch (e) { }

            const remainingOther = ps.other_deductions - customDeductionsTotal;
            if (remainingOther > 0) deductionsRows.push(['Other Deductions', formatCurrency(remainingOther)]);

            deductionsRows.push([{ content: 'Total Deductions', styles: { fontStyle: 'bold' } }, { content: formatCurrency(ps.cpf_employee + ps.shg_deduction + ps.other_deductions), styles: { fontStyle: 'bold' } }]);

            // Deductions Table
            autoTable(doc, {
                startY: y,
                head: [['Deductions', 'Amount (S$)']],
                body: deductionsRows,
                theme: 'grid',
                headStyles: { fillColor: [239, 68, 68] },
                styles: { fontSize: 9 },
            })

            y = doc.lastAutoTable.finalY + 10

            // CPF Breakdown
            autoTable(doc, {
                startY: y,
                head: [['CPF Breakdown', 'Amount (S$)']],
                body: [
                    ['CPF Employee Contribution', formatCurrency(ps.cpf_employee)],
                    ['CPF Employer Contribution', formatCurrency(ps.cpf_employer)],
                    ['Ordinary Account (OA)', formatCurrency(ps.cpf_oa)],
                    ['Special Account (SA)', formatCurrency(ps.cpf_sa)],
                    ['MediSave Account (MA)', formatCurrency(ps.cpf_ma)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] },
                styles: { fontSize: 9 },
            })

            y = doc.lastAutoTable.finalY + 10

            // Employer contributions
            autoTable(doc, {
                startY: y,
                head: [['Employer Contributions', 'Amount (S$)']],
                body: [
                    ['CPF Employer', formatCurrency(ps.cpf_employer)],
                    ['Skills Development Levy (SDL)', formatCurrency(ps.sdl)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [139, 92, 246] },
                styles: { fontSize: 9 },
            })

            y = doc.lastAutoTable.finalY + 15

            // Net Pay
            doc.setFontSize(14)
            doc.setFont(undefined, 'bold')
            doc.setTextColor(6, 182, 212)
            doc.text(`NET PAY: ${formatCurrency(ps.net_pay)}`, 105, y, { align: 'center' })

            // Footer
            doc.setFontSize(7)
            doc.setTextColor(150)
            doc.text('This is a computer-generated payslip. Compliant with Singapore MOM Employment Act itemized payslip requirements.', 105, 285, { align: 'center' })

            // Timesheet Appended Page
            if (ps.timesheets && ps.timesheets.length > 0) {
                doc.addPage();
                doc.setFontSize(14)
                doc.setTextColor(6, 182, 212)
                doc.text('DETAILED TIMESHEET ATTENDANCE', 105, 20, { align: 'center' })

                doc.setFontSize(9)
                doc.setTextColor(0)
                doc.text(`Employee: ${ps.employee_name} (${ps.employee_code})`, 14, 30)
                doc.text(`Period: ${formatMonth(ps.period_year, ps.period_month)}`, 14, 36)

                const tsBody = ps.timesheets.map(t => [
                    formatDate(t.date),
                    t.shift || '',
                    t.in_time || '',
                    t.out_time || '',
                    (t.ot_1_5_hours > 0 ? t.ot_1_5_hours : '-'),
                    (t.ot_2_0_hours > 0 ? t.ot_2_0_hours : '-'),
                    t.remarks || ''
                ]);

                autoTable(doc, {
                    startY: 45,
                    head: [['Date', 'Shift', 'In', 'Out', 'OT 1.5x', 'OT 2.0x', 'Remarks']],
                    body: tsBody,
                    theme: 'grid',
                    headStyles: { fillColor: [15, 23, 42] },
                    styles: { fontSize: 8 },
                })
            }

            doc.save(`payslip_${ps.employee_code}_${ps.period_year}_${ps.period_month}.pdf`)
            toast.success('PDF downloaded')
        } catch (err) {
            toast.error('PDF export failed: ' + err.message)
        }
    }

    if (loading) return <div className="card-base h-96 loading-shimmer" />
    if (!payslip) return <div className="text-center py-20 text-[var(--text-muted)]">Payslip not found</div>

    const ps = payslip
    const totalDeductions = ps.cpf_employee + ps.shg_deduction + ps.other_deductions

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/payroll')} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">← Back</button>
                    <img src="/ezyhr-logo.png" alt="ezyHR" className="h-14 object-contain" />
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)]">Itemized Payslip</h1>
                        <p className="text-[var(--text-muted)]">{formatMonth(ps.period_year, ps.period_month)}</p>
                    </div>
                </div>
                <button onClick={handleExportPDF} className="btn-primary text-sm">📥 Export PDF</button>
            </div>

            {/* MOM Compliance Badge */}
            <div className="card-base p-3 border-[var(--brand-primary)]/30 bg-cyan-500/5 flex items-center gap-2">
                <span>✅</span>
                <p className="text-xs text-[var(--brand-primary)] font-medium">MOM Compliant Itemized Payslip — Employment Act</p>
            </div>

            {/* Payslip Content */}
            <div className="card-base p-6 space-y-6" id="payslip-content">
                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[var(--border-main)]">
                    <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase">Employer</p>
                        <p className="text-sm font-medium text-[var(--text-main)]">{ps.entity_name || 'ezyHR Pte Ltd'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase">Employee</p>
                        <p className="text-sm font-medium text-[var(--text-main)]">{ps.employee_name} ({ps.employee_code})</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase">Salary Period</p>
                        <p className="text-sm text-[var(--text-main)]">{formatMonth(ps.period_year, ps.period_month)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase">Payment Mode</p>
                        <p className="text-sm text-[var(--text-main)]">{ps.payment_mode || 'Bank Transfer'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase">Payment Date</p>
                        <p className="text-sm text-[var(--text-main)]">{ps.payment_date ? formatDate(ps.payment_date) : formatDate(ps.run_date)}</p>
                    </div>
                </div>

                {/* Earnings */}
                <div>
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">💰 Earnings</h3>
                    <div className="space-y-2">
                        <Row label="Basic Salary" value={ps.basic_salary} />
                        <Row label="Transport Allowance" value={ps.transport_allowance} />
                        <Row label="Meal Allowance" value={ps.meal_allowance} />
                        <Row label="Other Allowance" value={ps.other_allowance} />

                        {ps.custom_allowances && ps.custom_allowances !== '{}' && Object.entries(JSON.parse(ps.custom_allowances)).map(([k, v]) => (
                            <Row key={k} label={k} value={v} />
                        ))}

                        {ps.ot_1_5_hours > 0 && <Row label={`Overtime 1.5x (${ps.ot_1_5_hours} hrs)`} value={ps.ot_1_5_pay} />}
                        {ps.ot_2_0_hours > 0 && <Row label={`Overtime 2.0x (${ps.ot_2_0_hours} hrs)`} value={ps.ot_2_0_pay} />}
                        {ps.overtime_hours > 0 && ps.ot_1_5_hours === 0 && ps.ot_2_0_hours === 0 && <Row label={`Overtime (${ps.overtime_hours} hrs)`} value={ps.overtime_pay} />}

                        {ps.bonus > 0 && <Row label="Bonus" value={ps.bonus} />}
                        {ps.unpaid_leave_days > 0 && <Row label={`Unpaid Leave (${ps.unpaid_leave_days} days)`} value={-ps.unpaid_leave_deduction} isNegative />}
                        <Row label="Gross Pay" value={ps.gross_pay} isBold isHighlight />
                    </div>
                </div>

                {/* Deductions */}
                <div>
                    <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">📉 Employee Deductions</h3>
                    <div className="space-y-2">
                        <Row label="CPF Employee Contribution" value={ps.cpf_employee} />
                        <Row label={`Self-Help Group (${ps.shg_fund || 'N/A'})`} value={ps.shg_deduction} />

                        {ps.custom_deductions && ps.custom_deductions !== '{}' && Object.entries(JSON.parse(ps.custom_deductions)).map(([k, v]) => (
                            <Row key={k} label={k} value={v} />
                        ))}

                        {(ps.other_deductions - (ps.custom_deductions && ps.custom_deductions !== '{}' ? Object.values(JSON.parse(ps.custom_deductions)).reduce((sum, val) => sum + Number(val), 0) : 0)) > 0 && (
                            <Row label="Other Deductions" value={ps.other_deductions - (ps.custom_deductions && ps.custom_deductions !== '{}' ? Object.values(JSON.parse(ps.custom_deductions)).reduce((sum, val) => sum + Number(val), 0) : 0)} />
                        )}

                        <Row label="Total Deductions" value={totalDeductions} isBold />
                    </div>
                </div>

                {/* CPF Breakdown */}
                <div>
                    <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">🏦 CPF Breakdown</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Row label="Employee CPF" value={ps.cpf_employee} />
                            <Row label="Employer CPF" value={ps.cpf_employer} />
                        </div>
                        <div className="space-y-2">
                            <Row label="Ordinary Account (OA)" value={ps.cpf_oa} />
                            <Row label="Special Account (SA)" value={ps.cpf_sa} />
                            <Row label="MediSave Account (MA)" value={ps.cpf_ma} />
                        </div>
                    </div>
                </div>

                {/* Employer Costs */}
                <div>
                    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">🏢 Employer Contributions</h3>
                    <div className="space-y-2">
                        <Row label="CPF Employer" value={ps.cpf_employer} />
                        <Row label="Skills Development Levy (SDL)" value={ps.sdl} />
                    </div>
                </div>

                {/* Net Pay */}
                <div className="pt-4 border-t-2 border-[var(--brand-primary)]/30 mb-8">
                    <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[var(--text-main)]">NET PAY</span>
                        <span className="text-2xl font-bold gradient-text">{formatCurrency(ps.net_pay)}</span>
                    </div>
                </div>

                {/* Detailed Timesheet Append */}
                {ps.timesheets && ps.timesheets.length > 0 && (
                    <div className="pt-6 border-t border-[var(--border-main)] space-y-4">
                        <h3 className="text-sm font-semibold text-[var(--brand-primary)] uppercase tracking-wider mb-3">🕒 Detailed Timesheet Attendance</h3>
                        <div className="overflow-x-auto">
                            <table className="table-theme w-full text-xs">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Shift</th>
                                        <th>In</th>
                                        <th>Out</th>
                                        <th>OT 1.5x</th>
                                        <th>OT 2.0x</th>
                                        <th>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ps.timesheets.map(t => (
                                        <tr key={t.id}>
                                            <td className="text-[var(--text-muted)]">{formatDate(t.date)}</td>
                                            <td className="text-[var(--text-main)]">{t.shift || ''}</td>
                                            <td className="text-emerald-400">{t.in_time || ''}</td>
                                            <td className="text-amber-400">{t.out_time || ''}</td>
                                            <td className="text-[var(--brand-primary)]">{t.ot_1_5_hours > 0 ? t.ot_1_5_hours : '-'}</td>
                                            <td className="text-purple-400">{t.ot_2_0_hours > 0 ? t.ot_2_0_hours : '-'}</td>
                                            <td className="text-[var(--text-muted)]">{t.remarks || ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function Row({ label, value, isBold, isHighlight, isNegative }) {
    return (
        <div className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
            <span className={`text-sm ${isBold ? 'font-semibold text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
            <span className={`text-sm ${isBold ? 'font-semibold' : ''} ${isHighlight ? 'text-[var(--brand-primary)]' : isNegative ? 'text-red-400' : 'text-[var(--text-main)]'}`}>
                {isNegative ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
            </span>
        </div>
    )
}
