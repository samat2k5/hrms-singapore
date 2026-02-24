import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formVisible, setFormVisible] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const data = await api.getCustomers();
            setCustomers(data);
        } catch (err) {
            toast.error(err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await api.updateCustomer(editingCustomer.id, formData);
                toast.success('Customer updated successfully');
            } else {
                await api.createCustomer(formData);
                toast.success('Customer created successfully');
            }

            setFormVisible(false);
            setEditingCustomer(null);
            setFormData({ name: '', description: '' });
            fetchCustomers();
        } catch (err) {
            toast.error(err.message);
            setError(err.message);
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({ name: customer.name, description: customer.description || '' });
        setFormVisible(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this customer? All associated sites and their working hours will be deleted!')) return;

        try {
            await api.deleteCustomer(id);
            toast.success('Customer deleted successfully');
            fetchCustomers();
        } catch (err) {
            toast.error(err.message);
            setError(err.message);
        }
    };

    if (loading) return <div className="p-6">Loading Customers...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-500">Master Customers</h1>
                    <p className="text-gray-400">Manage your manpower client portfolio</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCustomer(null);
                        setFormData({ name: '', description: '' });
                        setFormVisible(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 text-[var(--text-main)] rounded-lg hover:opacity-90 shadow-[0_0_15px_rgba(45,212,191,0.2)]"
                >
                    + Add Customer
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg">{error}</div>}

            {formVisible && (
                <div className="mb-8 p-6 glass-panel rounded-xl border border-[var(--border-main)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-400 to-indigo-500"></div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h2>
                        <button onClick={() => setFormVisible(false)} className="text-gray-400 hover:text-[var(--text-main)]">✕</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-[var(--border-main)] rounded-lg px-4 py-2 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="e.g. Seatrium, ExxonMobil"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Description / Notes</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-[var(--border-main)] rounded-lg px-4 py-2 text-[var(--text-main)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Optional notes"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="button" onClick={() => setFormVisible(false)} className="px-4 py-2 text-gray-300 hover:text-[var(--text-main)] mr-3">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 text-[var(--text-main)] rounded-lg hover:opacity-90">
                                {editingCustomer ? 'Save Changes' : 'Create Customer'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="glass-panel rounded-xl border border-[var(--border-main)] overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--border-main)] bg-[var(--bg-input)]">
                            <th className="p-4 font-medium text-gray-300">Name</th>
                            <th className="p-4 font-medium text-gray-300">Description</th>
                            <th className="p-4 font-medium text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map(customer => (
                            <tr key={customer.id} className="border-b border-[var(--border-main)] hover:bg-[var(--bg-input)] transition-colors">
                                <td className="p-4 font-medium text-[var(--text-main)]">{customer.name}</td>
                                <td className="p-4 text-gray-400">{customer.description || '-'}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleEdit(customer)} className="text-teal-400 hover:text-teal-300 mr-4 transition-colors">Edit</button>
                                    <button onClick={() => handleDelete(customer.id)} className="text-red-400 hover:text-red-300 transition-colors">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {customers.length === 0 && (
                            <tr>
                                <td colSpan="3" className="p-8 text-center text-gray-500">
                                    No customers found. Create one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Customers;
