import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import api from '../services/api'
import { formatDate, formatCurrency } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'
import DatePicker from '../components/DatePicker'
import ReportViewer from '../components/ReportViewer'

const PAGE_SIZE = 20

const loadLogo = (url) => {
    return new Promise((resolve) => {
        if (!url) return resolve('/ezyhr-logo.png');
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve('/ezyhr-logo.png');
        img.src = url;
    });
};

export default function Leave() {
    const { activeEntity } = useAuth()
    const [tab, setTab] = useState('balances')
    const [employees, setEmployees] = useState([])
    const [leaveTypes, setLeaveTypes] = useState([])
    const [balances, setBalances] = useState([])
    const [requests, setRequests] = useState([])
    const [policies, setPolicies] = useState([])
    const [employeeGrades, setEmployeeGrades] = useState([])
    const [loading, setLoading] = useState(true)
    const [showApply, setShowApply] = useState(false)
    const [showPolicy, setShowPolicy] = useState(false)
    const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: 1, reason: '' })
    const [policyForm, setPolicyForm] = useState({ employee_grade: '', leave_type_id: '', base_days: 0, increment_per_year: 0, max_days: 0, carry_forward_max: 0, carry_forward_expiry_months: 12, encashment_allowed: false })
    const [preview, setPreview] = useState({ isOpen: false, pdfUrl: '', title: '' })
    const year = new Date().getFullYear()

    // Search & Filter State
    const [search, setSearch] = useState('')
    const [groupFilter, setGroupFilter] = useState('All')
    const [page, setPage] = useState(1)
    const [requestSearch, setRequestSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')

    const load = async () => {
        const currentEntityId = activeEntity?.id
        if (!currentEntityId) {
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const [emps, types, bals, reqs, pols, grades] = await Promise.all([
                api.getEmployees(), api.getLeaveTypes(), api.getAllLeaveBalances(year), api.getLeaveRequests(),
                api.getLeavePolicies(), api.getEmployeeGrades()
            ])

            // Note: api.getEmployeeGrades might return a result set or array depending on implementation
            const gradesList = Array.isArray(grades) ? grades : (grades.values ? grades.values.map(v => v[0]) : [])

            // ... local filtering ...
            const filteredEmps = emps.filter(e => e.status === 'Active' && Number(e.entity_id) === Number(currentEntityId))
            const filteredBals = bals.filter(b => Number(b.entity_id) === Number(currentEntityId))
            const filteredReqs = reqs.filter(r => Number(r.entity_id) === Number(currentEntityId))

            setEmployees(filteredEmps)
            setLeaveTypes(types)
            setBalances(filteredBals)
            setRequests(filteredReqs)
            setPolicies(pols)
            setEmployeeGrades(gradesList)
        } catch (e) {
            console.error('Leave page load failed:', e)
            toast.error(e.message)
        }
        setLoading(false)
    }
    useEffect(() => { load() }, [activeEntity?.id, year])

    const handleApply = async (e) => {
        e.preventDefault()
        try {
            await api.submitLeaveRequest(form)
            toast.success('Leave request submitted')
            setShowApply(false)
            setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: 1, reason: '' })
            load()
        } catch (err) { toast.error(err.message) }
    }

    const handleAction = async (id, action) => {
        const result = await Swal.fire({
            title: `Are you sure?`,
            text: `Do you want to ${action} this leave request?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: action === 'approve' ? '#10b981' : '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: `Yes, ${action}`,
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (!result.isConfirmed) return

        try {
            if (action === 'approve') await api.approveLeave(id)
            else await api.rejectLeave(id)
            toast.success(`Leave ${action}d`)
            load()
        } catch (err) { toast.error(err.message) }
    }

    const handleSavePolicy = async (e) => {
        e.preventDefault()
        try {
            await api.saveLeavePolicy(policyForm)
            toast.success('Policy saved successfully')
            setShowPolicy(false)
            setPolicyForm({ employee_grade: '', leave_type_id: '', base_days: 0, increment_per_year: 0, max_days: 0, carry_forward_max: 0, carry_forward_expiry_months: 12, encashment_allowed: false })
            load()
        } catch (err) { toast.error(err.message) }
    }

    const handleDeletePolicy = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Policy?',
            text: "Are you sure you want to remove this leave policy? This might affect existing balance calculations.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (!result.isConfirmed) return

        try {
            await api.deleteLeavePolicy(id)
            toast.success('Policy deleted')
            load()
        } catch (err) { toast.error(err.message) }
    }

    // Group balances by employee
    const byEmployee = useMemo(() => {
        const map = {}
        balances.forEach(b => {
            if (!map[b.employee_id]) map[b.employee_id] = { name: b.employee_name, code: b.employee_code, group: '', leaves: [] }
            map[b.employee_id].leaves.push(b)
        })
        // Attach group from employees list
        employees.forEach(emp => {
            if (map[emp.id]) map[emp.id].group = emp.employee_group || 'General'
        })
        return map
    }, [balances, employees])

    // Unique groups for filter
    const groups = useMemo(() => {
        const set = new Set(employees.map(e => e.employee_group || 'General'))
        return ['All', ...Array.from(set).sort()]
    }, [employees])

    // Filtered & paginated balances
    const filteredEmployees = useMemo(() => {
        const q = search.toLowerCase()
        return Object.entries(byEmployee).filter(([empId, data]) => {
            if (groupFilter !== 'All' && data.group !== groupFilter) return false
            if (q && !data.name.toLowerCase().includes(q) && !data.code.toLowerCase().includes(q)) return false
            return true
        })
    }, [byEmployee, search, groupFilter])

    const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE)
    const pagedEmployees = filteredEmployees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // Reset page when filter changes
    useEffect(() => { setPage(1) }, [search, groupFilter])

    // Filtered requests
    const filteredRequests = useMemo(() => {
        const q = requestSearch.toLowerCase()
        return requests.filter(r => {
            if (statusFilter !== 'All' && r.status !== statusFilter) return false
            if (q && !r.employee_name.toLowerCase().includes(q)) return false
            return true
        })
    }, [requests, requestSearch, statusFilter])

    // Dashboard Stats
    const dashStats = useMemo(() => {
        const pendingCount = requests.filter(r => r.status === 'Pending').length
        const approvedCount = requests.filter(r => r.status === 'Approved').length
        const totalEntitled = balances.reduce((sum, b) => sum + (b.entitled || 0), 0)
        const totalTaken = balances.reduce((sum, b) => sum + (b.taken || 0), 0)
        const avgUtilization = totalEntitled > 0 ? Math.round((totalTaken / totalEntitled) * 100) : 0
        // Most used leave type
        const typeCounts = {}
        requests.filter(r => r.status === 'Approved').forEach(r => {
            typeCounts[r.leave_type_name] = (typeCounts[r.leave_type_name] || 0) + r.days
        })
        const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
        return {
            totalEmployees: Object.keys(byEmployee).length,
            pendingCount,
            approvedCount,
            avgUtilization,
            topType: topType ? `${topType[0]} (${topType[1]}d)` : '—'
        }
    }, [requests, balances, byEmployee])

    const reportDate = new Date().toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
    const reportDateTime = new Date().toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    // --- PDF Export: Summary ---
    const exportSummaryPDF = async (isPreview = false) => {
        try {
            const jspdfModule = await import('jspdf');
            const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
            const autotableModule = await import('jspdf-autotable');
            const autoTable = autotableModule.default || autotableModule;

            if (!jsPDF || !autoTable) throw new Error("PDF libraries failed to load");

            const doc = new jsPDF('landscape')

            // Header Branding Update
            const logo = await loadLogo(activeEntity?.logo_url);
            doc.addImage(logo, activeEntity?.logo_url ? (activeEntity.logo_url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG') : 'PNG', 14, 10, 30, 15);

            doc.setFontSize(16)
            doc.setTextColor(6, 182, 212)
            doc.text('LEAVE BALANCES SUMMARY', 148, 20, { align: 'center' })
            doc.setFontSize(9)
            doc.setTextColor(100)
            doc.text(`Year: ${year} | Report Date: ${reportDateTime}`, 148, 27, { align: 'center' })

            const typeNames = leaveTypes.filter(lt => lt.name !== 'Unpaid Leave').map(lt => lt.name)
            const head = [['#', 'Employee', 'ID', 'Group', ...typeNames.flatMap(t => [t + ' (Ent)', t + ' (Ear)', t + ' (CF)', t + ' (Bal)'])]]

            const body = filteredEmployees.map(([empId, data], i) => {
                const row = [i + 1, data.name, data.code, data.group]
                typeNames.forEach(tn => {
                    const l = data.leaves.find(lv => lv.leave_type_name === tn)
                    row.push(l ? l.entitled : '-')
                    row.push(l ? l.earned : '-')
                    row.push(l ? (l.carried_forward || 0) : '-')
                    row.push(l ? l.balance : '-')
                })
                return row
            })

            doc.setFontSize(11)
            doc.setTextColor(0, 0, 0)
            doc.setFont(undefined, 'bold')
            doc.text(`Leave Balance as of: ${reportDate}`, 14, 38)

            autoTable(doc, {
                startY: 42,
                head,
                body,
                theme: 'grid',
                headStyles: { fillColor: [6, 182, 212], fontSize: 6 },
                styles: { fontSize: 6, cellPadding: 1.5 },
                margin: { bottom: 25 }
            })

            // Footer Branding
            doc.setFontSize(7)
            doc.setTextColor(150)
            const footerY = doc.internal.pageSize.height - 10;
            try {
                const ezyLogo = new Image();
                ezyLogo.src = '/ezyhr-logo.png';
                doc.addImage(ezyLogo, 'PNG', 14, footerY - 5, 12, 6);
                doc.text('Powered by ezyHR | The Future of Payroll', 28, footerY);
            } catch (e) { }
            doc.text(`Total: ${filteredEmployees.length} employees | MOM Compliant`, 148, footerY, { align: 'center' })

            if (isPreview) {
                const pdfUrl = doc.output('bloburl');
                setPreview({ isOpen: true, pdfUrl, title: `Leave Summary ${year}` });
            } else {
                doc.save(`leave_summary_${year}.pdf`)
                toast.success('Summary PDF downloaded')
            }
        } catch (err) {
            console.error('[LEAVE_SUMMARY_PDF_ERROR]', err)
            toast.error('PDF failed: ' + (err.message || 'Unknown error'))
        }
    }

    // --- PDF Export: Individual Employee ---
    const handleTransmit = async (empId, data, mode) => {
        const emp = employees.find(e => String(e.id) === String(empId));
        if (!emp) {
            toast.error('Employee details not found');
            return;
        }

        if (mode === 'whatsapp') {
            const phone = emp.whatsapp_number || emp.mobile_number;
            if (!phone) {
                toast.error('WhatsApp/Mobile number not found for this employee');
                return;
            }
            const cleanPhone = phone.replace(/\D/g, '');
            const message = encodeURIComponent(`Hi ${emp.full_name}, your Leave Summary Report for ${year} is ready. You can view it on the ezyHR Portal.`);
            window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
        } else if (mode === 'email') {
            if (!emp.email) {
                toast.error('Employee email not found');
                return;
            }

            const tid = toast.loading('Preparing leave report and sending email...');
            try {
                const doc = await generateIndividualPDFDoc(empId, data);
                const pdfBase64 = doc.output('datauristring');

                await api.transmitEmail({
                    employeeId: emp.id,
                    pdfBase64,
                    fileName: `Leave_Report_${emp.full_name.replace(/\s+/g, '_')}_${year}.pdf`,
                    subject: `Your Leave Summary Report - ${year}`,
                    message: `Dear ${emp.full_name},\n\nPlease find your Leave Summary Report for the year ${year} attached.\n\nRegards,\nezyHR Team`
                });

                toast.success('Leave report sent via email successfully', { id: tid });
            } catch (err) {
                console.error(err);
                toast.error('Failed to transmit email: ' + err.message, { id: tid });
            }
        }
    }

    const generateIndividualPDFDoc = async (empId, data) => {
        const jspdfModule = await import('jspdf');
        const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
        const autotableModule = await import('jspdf-autotable');
        const autoTable = autotableModule.default || autotableModule;

        if (!jsPDF || !autoTable) throw new Error("PDF libraries failed to load");
        if (!data) throw new Error("Employee data missing");

        const doc = new jsPDF()

        // Header Branding Update
        const logo = await loadLogo(activeEntity?.logo_url);
        doc.addImage(logo, activeEntity?.logo_url ? (activeEntity.logo_url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG') : 'PNG', 14, 10, 40, 20);

        doc.setFontSize(16)
        doc.setTextColor(6, 182, 212)
        doc.text('INDIVIDUAL LEAVE RECORD', 105, 20, { align: 'center' })

        doc.setFontSize(10)
        doc.setTextColor(0)
        let y = 35
        doc.setFont(undefined, 'bold')
        doc.text('Employee:', 14, y)
        doc.setFont(undefined, 'normal')
        doc.text(`${data.name} (${data.code})`, 50, y)

        y += 7
        doc.setFont(undefined, 'bold')
        doc.text('Group:', 14, y)
        doc.setFont(undefined, 'normal')
        doc.text(data.group || 'General', 50, y)

        y += 7
        doc.setFont(undefined, 'bold')
        doc.text('Year:', 14, y)
        doc.setFont(undefined, 'normal')
        doc.text(String(year), 50, y)

        y += 12
        doc.setFont(undefined, 'bold')
        doc.text(`Leave Balance as of: ${reportDate}`, 14, y)

        const balanceBody = data.leaves
            .filter(l => !(l.entitled === 0 && l.leave_type_name === 'Unpaid Leave'))
            .map(l => [l.leave_type_name, l.entitled, l.earned, l.carried_forward || 0, l.taken, l.balance])

        autoTable(doc, {
            startY: y + 5,
            head: [['Leave Type', 'Entitled', 'Earned', 'Carried Fwd', 'Taken', 'Balance']],
            body: balanceBody,
            theme: 'grid',
            headStyles: { fillColor: [6, 182, 212] },
            styles: { fontSize: 9 },
            margin: { bottom: 30 }
        })

        // Add leave history for this employee
        const empRequests = requests.filter(r => String(r.employee_id) === String(empId))
        if (empRequests.length > 0) {
            y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 12
            doc.setFontSize(12)
            doc.setTextColor(6, 182, 212)
            doc.text('Leave History', 14, y)

            const historyBody = empRequests.map(r => [
                r.leave_type_name,
                formatDate(r.start_date),
                formatDate(r.end_date),
                r.days,
                r.status,
                r.reason || '—'
            ])

            autoTable(doc, {
                startY: y + 5,
                head: [['Type', 'From', 'To', 'Days', 'Status', 'Reason']],
                body: historyBody,
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] },
                styles: { fontSize: 8 },
                margin: { bottom: 30 }
            })
        }

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
        doc.text(`Report generated on ${reportDateTime} | MOM Compliant Leave Records`, 105, footerY + 5, { align: 'center' })

        return doc;
    }

    const exportIndividualPDF = async (empId, data, isPreview = false) => {
        try {
            const doc = await generateIndividualPDFDoc(empId, data);
            if (isPreview) {
                const pdfUrl = doc.output('bloburl');
                setPreview({ isOpen: true, pdfUrl, title: `Leave Record - ${data.name}` });
            } else {
                doc.save(`leave_record_${data.code}_${year}.pdf`)
                toast.success('Individual PDF downloaded')
            }
        } catch (err) {
            console.error('[LEAVE_INDIVIDUAL_PDF_ERROR]', err)
            toast.error('PDF failed: ' + (err.message || 'Unknown error'))
        }
    }

    if (loading) return <div className="card-base h-96 loading-shimmer" />

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Leave Management</h1>
                    <p className="text-[var(--text-muted)] mt-1">Track balances and manage requests</p>
                </div>
                <button onClick={() => setShowApply(true)} className="btn-primary w-full sm:w-auto">+ Apply Leave</button>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="card-base p-4 text-center border-l-4 border-cyan-500">
                    <p className="text-2xl font-bold text-[var(--text-main)]">{dashStats.totalEmployees}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Total Employees</p>
                </div>
                <div className="card-base p-4 text-center border-l-4 border-amber-500">
                    <p className="text-2xl font-bold text-amber-400">{dashStats.pendingCount}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Pending Requests</p>
                </div>
                <div className="card-base p-4 text-center border-l-4 border-emerald-500">
                    <p className="text-2xl font-bold text-emerald-400">{dashStats.approvedCount}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Approved This Year</p>
                </div>
                <div className="card-base p-4 text-center border-l-4 border-blue-500">
                    <p className="text-2xl font-bold text-blue-400">{dashStats.avgUtilization}%</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Avg Utilization</p>
                </div>
                <div className="card-base p-4 text-center border-l-4 border-purple-500">
                    <p className="text-sm font-bold text-purple-400 truncate">{dashStats.topType}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Most Used Type</p>
                </div>
            </div>

            {/* Tabs */}
            {['balances', 'requests', 'settings'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                    className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)] border border-transparent'}`}>
                    {t === 'balances' ? '📊 Balances' : t === 'requests' ? '📝 Requests' : '⚙️ Policies'}
                </button>
            ))}

            {/* Balances Tab */}
            {tab === 'balances' && (
                <div className="space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="card-base p-4">
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search by name or employee ID..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="input-base !pl-10 w-full"
                                />
                            </div>
                            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="select-base w-full sm:w-40">
                                {groups.map(g => <option key={g} value={g}>{g === 'All' ? 'All Groups' : `Group ${g}`}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={() => exportSummaryPDF(true)} className="px-4 py-2 rounded-xl border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-cyan-500/10 transition-all text-sm whitespace-nowrap flex items-center gap-2">
                                    👁️ Preview
                                </button>
                                <button onClick={() => exportSummaryPDF(false)} className="px-4 py-2 rounded-xl border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-cyan-500/10 transition-all text-sm whitespace-nowrap flex items-center gap-2">
                                    📥 Download Summary
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-muted)]">
                            <span>Showing {pagedEmployees.length} of {filteredEmployees.length} employees</span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                        className="px-2 py-1 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition-all">‹ Prev</button>
                                    <span className="text-[var(--text-main)] font-medium">{page} / {totalPages}</span>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                        className="px-2 py-1 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition-all">Next ›</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Employee Leave Cards */}
                    <div className="grid gap-4">
                        {pagedEmployees.length === 0 && (
                            <div className="card-base p-8 text-center text-[var(--text-muted)]">
                                No employees match your search.
                            </div>
                        )}
                        {pagedEmployees.map(([empId, data]) => (
                            <div key={empId} className="card-base p-5 relative">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-[var(--text-main)]">{data.name}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">{data.code} · Group {data.group}</p>
                                    </div>
                                    <div className="flex items-center gap-2 h-8">
                                        <span className="text-xs text-[var(--text-muted)]">{year}</span>
                                        <select
                                            className="h-full px-3 text-[11px] rounded-lg bg-[var(--bg-input)] text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 hover:bg-[var(--bg-card)] transition-all cursor-pointer font-bold outline-none appearance-none"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'preview') exportIndividualPDF(empId, data, true);
                                                else if (val === 'pdf') exportIndividualPDF(empId, data, false);
                                                else if (val === 'email') handleTransmit(empId, data, 'email');
                                                else if (val === 'whatsapp') handleTransmit(empId, data, 'whatsapp');
                                                e.target.value = ''; // Reset
                                            }}
                                            value=""
                                        >
                                            <option value="" disabled>📤 Actions</option>
                                            <option value="preview">👁️ Preview PDF</option>
                                            <option value="pdf">📄 Download PDF</option>
                                            <option value="email">📧 Email</option>
                                            <option value="whatsapp">💬 WhatsApp</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {data.leaves.map(l => {
                                        if (l.entitled === 0 && l.leave_type_name === 'Unpaid Leave') return null
                                        const pct = l.entitled > 0 ? (l.taken / l.entitled) * 100 : 0
                                        return (
                                            <div key={l.id} className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)]">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs text-[var(--text-muted)] truncate">{l.leave_type_name}</p>
                                                    {(l.taken > ((l.carried_forward || 0) + l.earned)) && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">UNEARNED</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 mb-2">
                                                    <div className="flex items-end justify-between">
                                                        <span className="text-sm text-[var(--text-muted)]">Available Balance</span>
                                                        <div className="text-right">
                                                            <span className="text-lg font-bold text-[var(--text-main)]">{l.balance}</span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 mt-1 border-t border-[var(--border-main)]/50">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-[var(--text-muted)]">Carried Fwd</span>
                                                            <span className="text-xs font-semibold text-[var(--text-main)]">{l.carried_forward || 0}</span>
                                                        </div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[10px] text-[var(--text-muted)]">Earned TD</span>
                                                            <span className="text-xs font-semibold text-[var(--text-main)]">{l.earned}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-[var(--text-muted)]">Ann. Entitled</span>
                                                            <span className="text-xs font-semibold text-[var(--text-main)]">{l.entitled}</span>
                                                        </div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[10px] text-[var(--text-muted)]">Taken</span>
                                                            <span className="text-xs font-semibold text-red-400">{l.taken}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-[var(--bg-input)]">
                                                    <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <button onClick={() => setPage(1)} disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition-all text-[var(--text-muted)]">« First</button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition-all text-[var(--text-muted)]">‹ Prev</button>
                            <span className="px-3 py-1.5 text-[var(--text-main)] font-medium">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition-all text-[var(--text-muted)]">Next ›</button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition-all text-[var(--text-muted)]">Last »</button>
                        </div>
                    )}
                </div>
            )}

            {/* Requests Tab */}
            {tab === 'requests' && (
                <div className="space-y-4">
                    {/* ... existing requests UI ... */}
                    <div className="card-base p-4">
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search by employee name..."
                                    value={requestSearch}
                                    onChange={e => setRequestSearch(e.target.value)}
                                    className="input-base !pl-10 w-full"
                                />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-base w-full sm:w-40">
                                <option value="All">All Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-2">Showing {filteredRequests.length} of {requests.length} requests</p>
                    </div>

                    <div className="card-base overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="table-theme">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Leave Type</th>
                                        <th>Start</th>
                                        <th>End</th>
                                        <th>Days</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map(r => (
                                        <tr key={r.id}>
                                            <td className="font-medium text-[var(--text-main)]">{r.employee_name}</td>
                                            <td>{r.leave_type_name}</td>
                                            <td>{formatDate(r.start_date)}</td>
                                            <td>{formatDate(r.end_date)}</td>
                                            <td>{r.days}</td>
                                            <td className="max-w-[200px] truncate">{r.reason || '—'}</td>
                                            <td>
                                                <span className={r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td>
                                                {r.status === 'Pending' && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleAction(r.id, 'approve')} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">✓</button>
                                                        <button onClick={() => handleAction(r.id, 'reject')} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">✕</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRequests.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-[var(--text-muted)]">No leave requests match your filters</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Policies Tab */}
            {tab === 'settings' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-[var(--text-main)]">Leave Policies</h2>
                        <button onClick={() => {
                            setPolicyForm({ employee_grade: '', leave_type_id: '', base_days: 0, increment_per_year: 0, max_days: 0, carry_forward_max: 0, carry_forward_expiry_months: 12, encashment_allowed: false })
                            setShowPolicy(true)
                        }} className="btn-primary py-2 text-sm">+ Add Policy</button>
                    </div>

                    <div className="card-base overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="table-theme">
                                <thead>
                                    <tr>
                                        <th>Grade</th>
                                        <th>Type</th>
                                        <th>Base Days</th>
                                        <th>Increment/Yr</th>
                                        <th>Max Days</th>
                                        <th>Carry Fwd Max</th>
                                        <th>Encashable</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {policies.map(p => (
                                        <tr key={p.id}>
                                            <td className="font-bold text-cyan-400">{p.employee_grade}</td>
                                            <td className="font-medium">{p.leave_type_name}</td>
                                            <td>{p.base_days}</td>
                                            <td>+{p.increment_per_year}</td>
                                            <td>{p.max_days || '—'}</td>
                                            <td>{p.carry_forward_max} ({p.carry_forward_expiry_months}m)</td>
                                            <td>{p.encashment_allowed ? '✅' : '❌'}</td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => {
                                                        setPolicyForm({ ...p, encashment_allowed: !!p.encashment_allowed })
                                                        setShowPolicy(true)
                                                    }} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">✏️</button>
                                                    <button onClick={() => handleDeletePolicy(p.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {policies.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-[var(--text-muted)]">No policies configured yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Modal */}
            {showApply && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card-base p-6 w-full max-w-lg animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Apply Leave</h2>
                            <button onClick={() => setShowApply(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl">×</button>
                        </div>
                        <form onSubmit={handleApply} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Employee</label>
                                <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: parseInt(e.target.value) })} className="select-base" required>
                                    <option value="">Select employee</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Leave Type</label>
                                <select value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: parseInt(e.target.value) })} className="select-base" required>
                                    <option value="">Select type</option>
                                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DatePicker
                                    label="Start Date"
                                    selected={form.start_date}
                                    onChange={val => setForm({ ...form, start_date: val })}
                                    required
                                />
                                <DatePicker
                                    label="End Date"
                                    selected={form.end_date}
                                    onChange={val => setForm({ ...form, end_date: val })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Days</label>
                                <input type="number" value={form.days} onChange={e => setForm({ ...form, days: parseFloat(e.target.value) || 0 })} className="input-base" min="0.5" step="0.5" required />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Reason</label>
                                <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-base" placeholder="Optional" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowApply(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Policy Modal */}
            {showPolicy && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card-base p-6 w-full max-w-xl animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Configure Policy</h2>
                            <button onClick={() => setShowPolicy(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSavePolicy} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1.5">Employee Grade</label>
                                    <select value={policyForm.employee_grade} onChange={e => setPolicyForm({ ...policyForm, employee_grade: e.target.value })} className="select-base" required>
                                        <option value="">Select Grade</option>
                                        {employeeGrades.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1.5">Leave Type</label>
                                    <select value={policyForm.leave_type_id} onChange={e => setPolicyForm({ ...policyForm, leave_type_id: parseInt(e.target.value) })} className="select-base" required>
                                        <option value="">Select Type</option>
                                        {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-[var(--border-main)] pt-4 md:col-span-2">
                                <h3 className="text-xs font-bold text-[var(--brand-primary)] uppercase tracking-wider mb-3">Entitlement Rules</h3>
                            </div>

                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Base Days (Year 1)</label>
                                <input type="number" value={policyForm.base_days} onChange={e => setPolicyForm({ ...policyForm, base_days: parseFloat(e.target.value) || 0 })} className="input-base" required min="0" step="0.5" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Increment Per Year</label>
                                <input type="number" value={policyForm.increment_per_year} onChange={e => setPolicyForm({ ...policyForm, increment_per_year: parseFloat(e.target.value) || 0 })} className="input-base" min="0" step="0.5" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Max Possible Days</label>
                                <input type="number" value={policyForm.max_days} onChange={e => setPolicyForm({ ...policyForm, max_days: parseFloat(e.target.value) || 0 })} className="input-base" min="0" step="0.5" placeholder="0 for unlimited" />
                            </div>

                            <div className="border-t border-[var(--border-main)] pt-4 md:col-span-2">
                                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">Year-End Compliance</h3>
                            </div>

                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">Carry Forward Limit</label>
                                <input type="number" value={policyForm.carry_forward_max} onChange={e => setPolicyForm({ ...policyForm, carry_forward_max: parseFloat(e.target.value) || 0 })} className="input-base" min="0" step="0.5" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1.5">CF Expiry (Months)</label>
                                <input type="number" value={policyForm.carry_forward_expiry_months} onChange={e => setPolicyForm({ ...policyForm, carry_forward_expiry_months: parseInt(e.target.value) || 0 })} className="input-base" min="1" />
                            </div>
                            <div className="md:col-span-2 px-1">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={policyForm.encashment_allowed} onChange={e => setPolicyForm({ ...policyForm, encashment_allowed: e.target.checked })} className="w-5 h-5 rounded-lg text-cyan-500 bg-[var(--bg-input)] border border-[var(--border-main)]" />
                                    <span className="text-sm text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">Allow Encashment of Unused Leave</span>
                                </label>
                            </div>

                            <div className="md:col-span-2 flex gap-3 pt-4 border-t border-[var(--border-main)]">
                                <button type="button" onClick={() => setShowPolicy(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Policy</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ReportViewer
                isOpen={preview.isOpen}
                onClose={() => setPreview({ ...preview, isOpen: false })}
                pdfUrl={preview.pdfUrl}
                title={preview.title}
            />
        </div>
    )
}
