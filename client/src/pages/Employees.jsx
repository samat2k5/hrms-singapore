import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const Employees = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

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
        if (!window.confirm('Are you sure you want to delete this employee?')) return;
        try {
            await api.deleteEmployee(id);
            toast.success('Employee deleted');
            loadEmployees();
        } catch (err) {
            toast.error('Failed to delete employee');
        }
    };

    const handleEdit = (emp) => {
        navigate(`/employees/edit/${emp.id}`);
    };

    const handleResetFace = async (emp) => {
        if (!window.confirm(`Are you sure you want to reset biometric face data for ${emp.full_name}?`)) return;
        try {
            await api.resetEmployeeFace(emp.id);
            toast.success('Biometric data reset successfully');
            loadEmployees();
        } catch (err) {
            toast.error(err.message || 'Failed to reset biometric data');
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

    const filtered = employees.filter(emp =>
        emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">Employees</h1>
                <div className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Search employees..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="glass-input px-4 py-2 rounded-xl text-sm w-64"
                    />
                    <button
                        onClick={() => navigate('/employees/add')}
                        className="brand-button px-6 py-2 rounded-xl text-sm font-bold text-white"
                    >
                        + Add Employee
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border border-[var(--border-main)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-main)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="py-4 px-6 font-semibold">ID</th>
                                <th className="py-4 px-6 font-semibold">Name & Designation</th>
                                <th className="py-4 px-6 font-semibold">Department</th>
                                <th className="py-4 px-6 font-semibold">Group</th>
                                <th className="py-4 px-6 font-semibold">Nationality</th>
                                <th className="py-4 px-6 font-semibold">Status</th>
                                <th className="py-4 px-6 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)]">
                            {filtered.map(emp => (
                                <tr key={emp.id} className="hover:bg-[var(--bg-main)] transition-colors">
                                    <td className="py-4 px-6 font-bold text-[var(--brand-primary)]">{emp.employee_id}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-[var(--text-main)]">{emp.full_name}</div>
                                            {emp.face_descriptor && (
                                                <span className="flex items-center justify-center w-5 h-5 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-full text-[10px]" title="Face Enrolled">
                                                    🛡️
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{emp.designation}</div>
                                    </td>
                                    <td className="py-4 px-6 text-sm">{emp.department}</td>
                                    <td className="py-4 px-6">
                                        <span className="badge-neutral text-xs">{emp.employee_group || 'General'}</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`text-xs px-2 py-1 rounded-full ${emp.nationality === 'Citizen' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {emp.nationality}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`text-xs px-2 py-1 rounded-full ${emp.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {emp.status}
                                        </span>
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
