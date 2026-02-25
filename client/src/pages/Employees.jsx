import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const Employees = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ department: '', group: '', nationality: '', status: '' });

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            setLoading(true);
            const data = await api.getEmployees();
            setEmployees(data);
        } catch (err) {
            toast.error('Failed to load employees');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (result.isConfirmed) {
            try {
                await api.deleteEmployee(id);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Employee has been deleted.',
                    icon: 'success',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    customClass: {
                        popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
                    }
                });
                loadEmployees();
            } catch (err) {
                toast.error('Failed to delete employee');
            }
        }
    };

    const handleEdit = (emp) => {
        navigate(`/employees/edit/${emp.id}`);
    };

    const handleResetFace = async (emp) => {
        const result = await Swal.fire({
            title: 'Reset Biometric Data?',
            text: `Are you sure you want to clear the registered face for ${emp.full_name}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#f97316',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, Reset',
            cancelButtonText: 'Cancel',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (result.isConfirmed) {
            try {
                await api.resetEmployeeFace(emp.id);
                Swal.fire({
                    title: 'Reset Complete',
                    text: 'Face biometric data has been nullified.',
                    icon: 'success',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    customClass: {
                        popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
                    }
                });
                loadEmployees();
            } catch (err) {
                toast.error(err.message || 'Failed to reset biometric data');
            }
        }
    };

    const openTransferModal = (emp) => {
        const targetEntityId = prompt('Enter target Entity ID to transfer:');
        if (!targetEntityId) return;
        api.transferEmployee(emp.id, targetEntityId)
            .then(() => {
                toast.success('Employee transferred successfully');
                loadEmployees();
            })
            .catch(err => toast.error(err.message));
    };

    const filtered = employees.filter(emp => {
        const matchesSearch = emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
            emp.employee_id.toLowerCase().includes(search.toLowerCase());
        const matchesDept = !filters.department || emp.department === filters.department;
        const matchesGroup = !filters.group || emp.employee_group === filters.group;
        const matchesNation = !filters.nationality || emp.nationality === filters.nationality;
        const matchesStatus = !filters.status || emp.status === filters.status;
        return matchesSearch && matchesDept && matchesGroup && matchesNation && matchesStatus;
    });

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">Employees</h1>
                <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">🔍</span>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-glass !pl-9 !pr-4 !py-2.5 !rounded-xl text-sm w-full md:w-64"
                        />
                    </div>
                    <button
                        onClick={() => navigate('/employees/add')}
                        className="btn-primary !py-2.5 !px-6 !text-sm whitespace-nowrap"
                    >
                        + Add Employee
                    </button>
                </div>
            </div>

            {/* Stats/Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="input-glass !p-1 !rounded-2xl flex items-center bg-[var(--bg-input)]">
                    <span className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase">Dept</span>
                    <select
                        className="bg-transparent border-none outline-none text-xs text-[var(--text-main)] w-full py-2 cursor-pointer"
                        value={filters.department || ''}
                        onChange={e => setFilters({ ...filters, department: e.target.value })}
                    >
                        <option value="" className="bg-[var(--bg-card)]">All Departments</option>
                        {[...new Set(employees.map(e => e.department))].filter(Boolean).sort().map(d => (
                            <option key={d} value={d} className="bg-[var(--bg-card)]">{d}</option>
                        ))}
                    </select>
                </div>
                <div className="input-glass !p-1 !rounded-2xl flex items-center bg-[var(--bg-input)]">
                    <span className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase">Group</span>
                    <select
                        className="bg-transparent border-none outline-none text-xs text-[var(--text-main)] w-full py-2 cursor-pointer"
                        value={filters.group || ''}
                        onChange={e => setFilters({ ...filters, group: e.target.value })}
                    >
                        <option value="" className="bg-[var(--bg-card)]">All Groups</option>
                        {[...new Set(employees.map(e => e.employee_group))].filter(Boolean).sort().map(g => (
                            <option key={g} value={g} className="bg-[var(--bg-card)]">{g}</option>
                        ))}
                    </select>
                </div>
                <div className="input-glass !p-1 !rounded-2xl flex items-center bg-[var(--bg-input)]">
                    <span className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase">Origin</span>
                    <select
                        className="bg-transparent border-none outline-none text-xs text-[var(--text-main)] w-full py-2 cursor-pointer"
                        value={filters.nationality || ''}
                        onChange={e => setFilters({ ...filters, nationality: e.target.value })}
                    >
                        <option value="" className="bg-[var(--bg-card)]">All Regions</option>
                        {[...new Set(employees.map(e => e.nationality))].filter(Boolean).sort().map(n => (
                            <option key={n} value={n} className="bg-[var(--bg-card)]">{n}</option>
                        ))}
                    </select>
                </div>
                <div className="input-glass !p-1 !rounded-2xl flex items-center bg-[var(--bg-input)]">
                    <span className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase">Status</span>
                    <select
                        className="bg-transparent border-none outline-none text-xs text-[var(--text-main)] w-full py-2 cursor-pointer"
                        value={filters.status || ''}
                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="" className="bg-[var(--bg-card)]">All Status</option>
                        <option value="Active" className="bg-[var(--bg-card)]">Active</option>
                        <option value="Inactive" className="bg-[var(--bg-card)]">Inactive</option>
                        <option value="Resigned" className="bg-[var(--bg-card)]">Resigned</option>
                    </select>
                </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border border-[var(--border-main)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-main)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="py-4 px-6 font-semibold">ID</th>
                                <th className="py-4 px-6 font-semibold">Name & Designation</th>
                                <th className="py-4 px-6 font-semibold">Status</th>
                                <th className="py-4 px-6 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                            {filtered.map(emp => (
                                <tr key={emp.id} className="hover:bg-[var(--bg-main)] transition-colors">
                                    <td className="py-4 px-6 font-bold text-[var(--brand-primary)]">{emp.employee_id}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full border border-[var(--border-main)] overflow-hidden bg-[var(--bg-input)] shadow-sm">
                                                {emp.photo_url ? (
                                                    <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-black">
                                                        {emp.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-[var(--text-main)]">{emp.full_name}</div>
                                                    {emp.face_descriptor && (
                                                        <span className="flex items-center justify-center w-4 h-4 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-full text-[8px]" title="Face Enrolled">
                                                            🛡️
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{emp.designation}</div>
                                                <div className="flex gap-1 mt-1">
                                                    <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase bg-[var(--bg-input)] px-1.5 py-0.5 rounded-md border border-[var(--border-main)]">{emp.department}</span>
                                                    {emp.employee_group && (
                                                        <span className="text-[8px] font-bold text-[var(--brand-primary)] uppercase bg-[var(--brand-primary)]/5 px-1.5 py-0.5 rounded-md border border-[var(--brand-primary)]/10">{emp.employee_group}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col gap-1.5">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md w-fit ${emp.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {emp.status}
                                            </span>
                                            <span className="text-[9px] text-[var(--text-muted)] font-medium bg-[var(--bg-input)] px-1.5 py-0.5 rounded w-fit italic">
                                                {emp.nationality}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => navigate(`/employees/${emp.id}/kets`)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-sm" title="KETs">📋</button>
                                            <button onClick={() => navigate(`/employees/${emp.id}/documents`)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-sm" title="Documents">🪪</button>
                                            <button onClick={() => navigate(`/employees/${emp.id}/face`)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-sm" title="Face Enrollment">👤</button>
                                            {emp.face_descriptor && (
                                                <button onClick={() => handleResetFace(emp)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-orange-500 hover:text-white transition-all shadow-sm text-orange-500" title="Reset Face Data">🔄</button>
                                            )}
                                            <button onClick={() => handleEdit(emp)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-sm" title="Edit">✏️</button>
                                            {emp.status === 'Active' && (
                                                <button onClick={() => openTransferModal(emp)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-sm" title="Transfer">↗️</button>
                                            )}
                                            <button onClick={() => handleDelete(emp.id)} className="w-8 h-8 flex items-center justify-center border border-[var(--border-main)] bg-[var(--bg-input)] rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm text-rose-500" title="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {loading && (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--brand-primary)] mb-4"></div>
                        <p className="text-[var(--text-muted)] text-sm font-medium">Loading employees...</p>
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="py-20 text-center text-[var(--text-muted)]">
                        <p className="text-4xl mb-4">🔍</p>
                        <p className="font-medium text-lg">No employees found matching your search</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Employees;
