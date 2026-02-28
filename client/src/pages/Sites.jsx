import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
const DAYS = [
    { label: 'Sunday', value: 0 },
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 }
];

const SHIFTS = ['Day', 'Night'];

function Sites() {
    const [sites, setSites] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formVisible, setFormVisible] = useState(false);
    const [editingSite, setEditingSite] = useState(null);

    // Matrix configuration modal state
    const [matrixVisible, setMatrixVisible] = useState(false);
    const [activeSite, setActiveSite] = useState(null);
    const [scheduleMatrix, setScheduleMatrix] = useState([]);

    const [formData, setFormData] = useState({
        customer_id: '',
        name: '',
        description: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [sitesData, custData] = await Promise.all([
                api.getSites(),
                api.getCustomers()
            ]);

            setSites(sitesData);
            setCustomers(custData);

            if (custData.length > 0) {
                setFormData(prev => ({ ...prev, customer_id: prev.customer_id || custData[0].id }));
            }
        } catch (err) {
            toast.error(err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customer_id) return toast.error('Select a customer first');

        try {
            if (editingSite) {
                await api.updateSite(editingSite.id, formData);
                toast.success('Site updated successfully');
            } else {
                await api.createSite(formData);
                toast.success('Site created successfully');
            }

            setFormVisible(false);
            setEditingSite(null);
            setFormData({ customer_id: customers.length ? customers[0].id : '', name: '', description: '' });
            fetchData();
        } catch (err) {
            toast.error(err.message);
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Site?',
            text: "Are you sure you want to delete this site? All schedules attached will be removed.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            customClass: {
                popup: 'glass-card border border-[var(--border-main)] rounded-2xl'
            }
        });

        if (!result.isConfirmed) return;
        try {
            await api.deleteSite(id);
            toast.success('Site deleted successfully');
            fetchData();
        } catch (err) {
            toast.error(err.message);
            setError(err.message);
        }
    };

    // --- Schedule Matrix Functions ---
    const openMatrix = async (site) => {
        setActiveSite(site);
        try {
            const existing = await api.getSiteHours(site.id);

            // Build default matrix grid
            const grid = [];
            SHIFTS.forEach(shift => {
                DAYS.forEach(day => {
                    const found = existing.find(e => e.shift_type === shift && e.day_of_week === day.value);
                    grid.push({
                        shift_type: shift,
                        day_of_week: day.value,
                        start_time: found?.start_time || '',
                        end_time: found?.end_time || '',
                        meal_start_time: found?.meal_start_time || '',
                        meal_end_time: found?.meal_end_time || '',
                        ot_start_time: found?.ot_start_time || '',
                        compulsory_ot_hours: found?.compulsory_ot_hours || 0,
                        ot_meal_start_time: found?.ot_meal_start_time || '',
                        ot_meal_end_time: found?.ot_meal_end_time || '',
                        late_arrival_threshold_mins: found?.late_arrival_threshold_mins || 0,
                        early_departure_threshold_mins: found?.early_departure_threshold_mins || 0,
                        performance_multiplier: found?.performance_multiplier || 1.0
                    });
                });
            });
            setScheduleMatrix(grid);
            setMatrixVisible(true);
        } catch (e) {
            toast.error(e.message);
        }
    };

    const updateMatrixCell = (shift, dayValue, field, value) => {
        setScheduleMatrix(prev => prev.map(cell => {
            if (cell.shift_type === shift && cell.day_of_week === dayValue) {
                return { ...cell, [field]: value };
            }
            return cell;
        }));
    };

    const saveMatrix = async () => {
        try {
            await api.updateSiteHours(activeSite.id, scheduleMatrix);

            setMatrixVisible(false);
            setActiveSite(null);
            toast.success('Working hours matrix saved successfully!');
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (loading) return <div className="p-6">Loading Sites...</div>;

    if (matrixVisible) {
        return (
            <div className="p-6 max-w-[1400px] mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Working Hours Matrix</h1>
                        <p className="text-gray-400">Configuring thresholds for: <span className="font-semibold text-[var(--text-main)]">{activeSite?.name} ({activeSite?.customer_name})</span></p>
                    </div>
                    <div className="space-x-4">
                        <button onClick={() => setMatrixVisible(false)} className="px-4 py-2 bg-slate-800 text-[var(--text-main)] rounded-lg hover:bg-slate-700">Cancel</button>
                        <button onClick={saveMatrix} className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-[var(--text-main)] rounded-lg hover:opacity-90 shadow-[0_0_15px_rgba(245,158,11,0.2)]">Save Configuration</button>
                    </div>
                </div>

                {SHIFTS.map(shift => (
                    <div key={shift} className="mb-8 overflow-x-auto">
                        <div className="inline-block min-w-full glass-panel rounded-xl border border-[var(--border-main)]">
                            <h2 className="text-xl font-semibold p-4 border-b border-[var(--border-main)] bg-[var(--bg-input)]">{shift} Shift Schedule</h2>
                            <table className="text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--border-main)] text-gray-400 text-sm">
                                        <th className="p-4 w-32">Day</th>
                                        <th className="p-4">Start Time</th>
                                        <th className="p-4">End Time</th>
                                        <th className="p-4">Meal Start</th>
                                        <th className="p-4">Meal End</th>
                                        <th className="p-4 text-orange-400 font-semibold">OT Gateway</th>
                                        <th className="p-4 text-orange-400 font-semibold" title="Overtime granted unconditionally upon completion of shift">Auto OT</th>
                                        <th className="p-4 text-orange-300">OT Meal Start</th>
                                        <th className="p-4 text-orange-300">OT Meal End</th>
                                        <th className="p-4 text-rose-400">Late (mins)</th>
                                        <th className="p-4 text-rose-300">Late Block</th>
                                        <th className="p-4 text-rose-400">Early Out (mins)</th>
                                        <th className="p-4 text-rose-300">Early Block</th>
                                        <th className="p-4 text-emerald-400">Perf. Mult</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DAYS.map(day => {
                                        const cell = scheduleMatrix.find(c => c.shift_type === shift && c.day_of_week === day.value) || {};
                                        return (
                                            <tr key={`${shift}-${day.value}`} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)]">
                                                <td className="p-4 font-medium text-gray-300">{day.label}</td>
                                                <td className="p-4 border-r border-[var(--border-main)]">
                                                    <input type="time" value={cell.start_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'start_time', e.target.value)} className="bg-slate-800 border border-[var(--border-main)] rounded px-2 py-1 text-sm text-[var(--text-main)] w-full" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)]">
                                                    <input type="time" value={cell.end_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'end_time', e.target.value)} className="bg-slate-800 border border-[var(--border-main)] rounded px-2 py-1 text-sm text-[var(--text-main)] w-full" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)]">
                                                    <input type="time" value={cell.meal_start_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'meal_start_time', e.target.value)} className="bg-slate-800 border border-[var(--border-main)] rounded px-2 py-1 text-sm text-[var(--text-main)] w-full" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)]">
                                                    <input type="time" value={cell.meal_end_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'meal_end_time', e.target.value)} className="bg-slate-800 border border-[var(--border-main)] rounded px-2 py-1 text-sm text-[var(--text-main)] w-full" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)] bg-orange-900/10">
                                                    <input type="time" value={cell.ot_start_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'ot_start_time', e.target.value)} className="bg-slate-800 border border-orange-500/30 rounded px-2 py-1 text-sm text-orange-100 font-mono w-full" title="Time after which OT calculation begins" />
                                                </td>
                                                <td className="p-4 bg-orange-900/10">
                                                    <input type="number" step="0.5" value={cell.compulsory_ot_hours || 0} onChange={e => updateMatrixCell(shift, day.value, 'compulsory_ot_hours', e.target.value)} className="bg-slate-800 border border-orange-500/30 rounded px-2 py-1 text-sm text-orange-100 font-mono w-full" title="E.g., 2.5 hours of guaranteed OT for night shift" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)]">
                                                    <input type="time" value={cell.ot_meal_start_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'ot_meal_start_time', e.target.value)} className="bg-slate-800 border border-[var(--border-main)] rounded px-2 py-1 text-sm text-[var(--text-main)] w-full" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)]">
                                                    <input type="time" value={cell.ot_meal_end_time || ''} onChange={e => updateMatrixCell(shift, day.value, 'ot_meal_end_time', e.target.value)} className="bg-slate-800 border border-[var(--border-main)] rounded px-2 py-1 text-sm text-[var(--text-main)] w-full" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)] bg-rose-900/10">
                                                    <input type="number" value={cell.late_arrival_threshold_mins || 0} onChange={e => updateMatrixCell(shift, day.value, 'late_arrival_threshold_mins', e.target.value)} className="bg-slate-800 border border-rose-500/30 rounded px-2 py-1 text-sm text-rose-100 font-mono w-full" title="Grace period in minutes before lateness penalty" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)] bg-rose-950/20">
                                                    <input type="number" value={cell.late_arrival_penalty_block_mins || 0} onChange={e => updateMatrixCell(shift, day.value, 'late_arrival_penalty_block_mins', e.target.value)} className="bg-slate-800 border border-rose-400/20 rounded px-2 py-1 text-sm text-rose-200 font-mono w-full" title="Round up penalty to this block (e.g. 15 mins)" />
                                                </td>
                                                <td className="p-4 border-r border-[var(--border-main)] bg-rose-900/10">
                                                    <input type="number" value={cell.early_departure_threshold_mins || 0} onChange={e => updateMatrixCell(shift, day.value, 'early_departure_threshold_mins', e.target.value)} className="bg-slate-800 border border-rose-500/30 rounded px-2 py-1 text-sm text-rose-100 font-mono w-full" title="Grace period in minutes before early checkout penalty" />
                                                </td>
                                                <td className="p-4 bg-rose-950/20">
                                                    <input type="number" value={cell.early_departure_penalty_block_mins || 0} onChange={e => updateMatrixCell(shift, day.value, 'early_departure_penalty_block_mins', e.target.value)} className="bg-slate-800 border border-rose-400/20 rounded px-2 py-1 text-sm text-rose-200 font-mono w-full" title="Round up penalty to this block (e.g. 15 mins)" />
                                                </td>
                                                <td className="p-4 bg-emerald-900/10">
                                                    <input type="number" step="0.1" value={cell.performance_multiplier || 1.0} onChange={e => updateMatrixCell(shift, day.value, 'performance_multiplier', e.target.value)} className="bg-slate-800 border border-emerald-500/30 rounded px-2 py-1 text-sm text-emerald-100 font-mono w-full" title="Multiplier for performance hour credits (e.g. 1.0, 1.5, 2.0)" />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Physical Sites</h1>
                    <p className="text-gray-400">Map work locations to customers and control schedules</p>
                </div>
                {customers.length > 0 && (
                    <button
                        onClick={() => {
                            setEditingSite(null);
                            setFormData({ customer_id: customers[0].id, name: '', description: '' });
                            setFormVisible(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-[var(--text-main)] rounded-lg hover:opacity-90 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    >
                        + Add Site
                    </button>
                )}
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg">{error}</div>}

            {customers.length === 0 && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
                    You must create at least one Customer before adding physical sites. Go to the Customers page first.
                </div>
            )}

            {formVisible && (
                <div className="mb-8 p-6 glass-panel rounded-xl border border-[var(--border-main)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-500"></div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">{editingSite ? 'Edit Site' : 'New Site Validation'}</h2>
                        <button onClick={() => setFormVisible(false)} className="text-gray-400 hover:text-[var(--text-main)]">✕</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Parent Customer *</label>
                                <select
                                    required
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-[var(--border-main)] rounded-lg px-4 py-2 text-[var(--text-main)] outline-none focus:border-amber-500"
                                >
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Site Name *</label>
                                <input
                                    type="text" required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-[var(--border-main)] rounded-lg px-4 py-2 text-[var(--text-main)] outline-none focus:border-amber-500"
                                    placeholder="e.g. Tuas Yard, Jurong Island"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-[var(--border-main)] rounded-lg px-4 py-2 text-[var(--text-main)] outline-none focus:border-amber-500"
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="button" onClick={() => setFormVisible(false)} className="px-4 py-2 text-gray-300 hover:text-[var(--text-main)] mr-3">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-[var(--text-main)] rounded-lg hover:opacity-90">
                                {editingSite ? 'Save Changes' : 'Create Site'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sites.map(site => (
                    <div key={site.id} className="glass-panel p-6 rounded-xl border border-[var(--border-main)] hover:border-[var(--border-main)] transition-all flex flex-col h-full bg-gradient-to-br from-white/[0.02] to-transparent relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-1 group-hover:text-amber-400 transition-colors">{site.name}</h3>
                                <p className="text-xs font-semibold px-2 py-1 bg-[var(--bg-input)] text-gray-300 rounded inline-block mb-2">
                                    {site.customer_name}
                                </p>
                                <p className="text-sm text-gray-400 line-clamp-2">{site.description || 'No description provided.'}</p>
                            </div>
                            <div className="flex flex-col space-y-2">
                                <button onClick={() => {
                                    setEditingSite(site);
                                    setFormData({ customer_id: site.customer_id, name: site.name, description: site.description || '' });
                                    setFormVisible(true);
                                }} className="text-gray-400 hover:text-[var(--text-main)] p-1 rounded hover:bg-[var(--bg-input)]">✎</button>
                                <button onClick={() => handleDelete(site.id)} className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-[var(--bg-input)]">✕</button>
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-[var(--border-main)]">
                            <button onClick={() => openMatrix(site)} className="w-full py-2 bg-[var(--bg-input)] hover:bg-amber-500/20 text-indigo-200 hover:text-amber-300 rounded border border-[var(--border-main)] hover:border-amber-500/50 transition-all text-sm font-medium flex justify-center items-center">
                                <span>Modify Matrix</span>
                                <span className="ml-2">→</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {sites.length === 0 && customers.length > 0 && (
                <div className="glass-panel p-12 text-center rounded-xl border border-[var(--border-main)]">
                    <p className="text-gray-400">No physical sites defined. Click the button above to add one.</p>
                </div>
            )}
        </div>
    );
}

export default Sites;
