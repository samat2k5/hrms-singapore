const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('hrms_token');
}

async function request(endpoint, options = {}) {
    const token = getToken();
    const entityStr = localStorage.getItem('hrms_entity');
    const entity = entityStr ? JSON.parse(entityStr) : null;

    // Determine if we are sending FormData
    const isFormData = options.body instanceof FormData;

    const headers = {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(entity && { 'Entity-Id': entity.id }),
        ...options.headers,
    };

    // Only set Content-Type to JSON if not FormData. Browser sets boundary for FormData automatically.
    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    } else if (isFormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers,
    };

    const res = await fetch(`${API_BASE}${endpoint}`, config);

    if (res.status === 401) {
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

const api = {
    // Auth
    login: (username, password) =>
        request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

    // Employees
    getEmployees: () => request('/employees'),
    getEmployee: (id) => request(`/employees/${id}`),
    createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
    transferEmployee: (id, targetEntityId) => request(`/employees/${id}/transfer`, { method: 'POST', body: JSON.stringify({ targetEntityId }) }),

    // KETs
    getKETs: (employeeId) => request(`/kets/${employeeId}`),
    updateKETs: (employeeId, data) => request(`/kets/${employeeId}`, { method: 'PUT', body: JSON.stringify(data) }),
    issueKETs: (employeeId) => request(`/kets/${employeeId}/issue`, { method: 'POST' }),

    // Leave
    getLeaveTypes: () => request('/leave/types'),
    getLeaveBalances: (employeeId, year) => request(`/leave/balances/${employeeId}/${year}`),
    getAllLeaveBalances: (year) => request(`/leave/balances-all/${year}`),
    getLeaveRequests: () => request('/leave/requests'),
    submitLeaveRequest: (data) => request('/leave/request', { method: 'POST', body: JSON.stringify(data) }),
    approveLeave: (id) => request(`/leave/request/${id}/approve`, { method: 'PUT' }),
    rejectLeave: (id) => request(`/leave/request/${id}/reject`, { method: 'PUT' }),

    // Timesheets
    uploadTimesheet: (formData) => request('/timesheets/upload', { method: 'POST', body: formData }),
    getTimesheets: (month) => request(`/timesheets${month ? `?month=${month}` : ''}`),

    // Payroll
    getPayrollRuns: () => request('/payroll/runs'),
    runPayroll: (year, month) => request('/payroll/run', { method: 'POST', body: JSON.stringify({ year, month }) }),
    getPayrollRun: (id) => request(`/payroll/run/${id}`),
    getPayslip: (id) => request(`/payroll/payslip/${id}`),
    deletePayrollRun: (id) => request(`/payroll/run/${id}`, { method: 'DELETE' }),

    // Documents
    getExpiringDocuments: () => request('/documents/expiring'),
    getDocuments: (employeeId) => request(`/documents/${employeeId}`),
    createDocument: (data) => request('/documents', { method: 'POST', body: data }),
    deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),

    // Payroll (group-based)
    runGroupPayroll: (year, month, employee_group) => request('/payroll/run', { method: 'POST', body: JSON.stringify({ year, month, employee_group }) }),

    // Reports
    getDashboard: () => request('/reports/dashboard'),
    getCPFReport: (year, month) => request(`/reports/cpf/${year}/${month}`),
    getIR8AReport: (year) => request(`/reports/ir8a/${year}`),
    getSDLReport: (year, month) => request(`/reports/sdl/${year}/${month}`),
    getSHGReport: (year, month) => request(`/reports/shg/${year}/${month}`),

    // Entities
    getEntities: () => request('/entities'),

    // Users
    getUsers: () => request('/users'),
    createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

    // Settings / Configurations
    createEntity: (data) => request('/entities', { method: 'POST', body: JSON.stringify(data) }),
    updateEntity: (id, data) => request(`/entities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEntity: (id) => request(`/entities/${id}`, { method: 'DELETE' }),

    getDepartments: () => request('/departments'),
    createDepartment: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
    updateDepartment: (id, data) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),

    getEmployeeGroups: () => request('/employee-groups'),
    createEmployeeGroup: (data) => request('/employee-groups', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployeeGroup: (id, data) => request(`/employee-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployeeGroup: (id) => request(`/employee-groups/${id}`, { method: 'DELETE' }),

    getHolidays: () => request('/holidays'),
    createHoliday: (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }),
    updateHoliday: (id, data) => request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),

    // User Roles
    getUserRoles: () => request('/user-roles'),
    createUserRole: (data) => request('/user-roles', { method: 'POST', body: JSON.stringify(data) }),
    updateUserRole: (id, data) => request(`/user-roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUserRole: (id) => request(`/user-roles/${id}`, { method: 'DELETE' }),
};

export default api;
