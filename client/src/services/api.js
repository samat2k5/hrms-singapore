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
    getEmployees: (entityId) => request(`/employees${entityId ? `?entityId=${entityId}` : ''}`),
    getEmployee: (id) => request(`/employees/${id}`),
    createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
    transferEmployee: (id, targetEntityId) => request(`/employees/${id}/transfer`, { method: 'POST', body: JSON.stringify({ targetEntityId }) }),
    updateBulkCustomModifiers: (records) => request('/employees/bulk-custom', { method: 'POST', body: JSON.stringify({ records }) }),
    importEmployees: (formData) => request('/employees/bulk-import', { method: 'POST', body: formData }),

    // Attendance
    uploadAttendance: (formData) => request('/attendance/import', { method: 'POST', body: formData }),
    getAttendanceHistory: () => request('/attendance/history'),
    getMonthlyTimesheets: (employeeId, year, month, entityId) =>
        request(`/attendance/monthly?employeeId=${employeeId}&year=${year}&month=${month}${entityId ? `&entityId=${entityId}` : ''}`),
    saveMonthlyTimesheets: (employeeId, records, entityId) =>
        request('/attendance/monthly', { method: 'POST', body: JSON.stringify({ employeeId, records, entityId }) }),

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

    // Leave Policies
    getLeavePolicies: () => request('/leave-policies'),
    saveLeavePolicy: (data) => request('/leave-policies', { method: 'POST', body: JSON.stringify(data) }),
    deleteLeavePolicy: (id) => request(`/leave-policies/${id}`, { method: 'DELETE' }),

    // Shift Settings
    getShiftSettings: () => request('/shift-settings'),
    saveShiftSetting: (data) =>
        data.id
            ? request(`/shift-settings/${data.id}`, { method: 'PUT', body: JSON.stringify(data) })
            : request('/shift-settings', { method: 'POST', body: JSON.stringify(data) }),
    deleteShiftSetting: (id) => request(`/shift-settings/${id}`, { method: 'DELETE' }),

    // Timesheets
    uploadTimesheet: (formData) => request('/timesheets/upload', { method: 'POST', body: formData }),
    getTimesheets: (month) => request(`/timesheets${month ? `?month=${month}` : ''}`),

    // Attendance Import
    importAttendance: (formData) => request('/attendance/import', { method: 'POST', body: formData }),
    getAttendanceHistory: () => request('/attendance/history'),

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

    // IRAS Compliance
    getIRASForms: (year) => request(`/iras/forms/${year}`),
    generateIR8A: (year) => request(`/iras/generate/${year}`, { method: 'POST' }),
    amendIR8A: (year, empId) => request(`/iras/amend/${year}/${empId}`, { method: 'POST' }),
    getIRASCessation: () => request('/iras/cessation-check'),
    getIRASCpfExcess: () => request('/iras/cpf-excess'),
    getIRASLogs: () => request('/iras/audit-logs'),
    exportAISJson: (year) => request(`/iras/export-ais-json/${year}`),

    getBenefits: (empId, year) => request(`/iras/benefits/${empId}/${year}`),
    addBenefit: (data) => request('/iras/benefits', { method: 'POST', body: JSON.stringify(data) }),
    deleteBenefit: (id) => request(`/iras/benefits/${id}`, { method: 'DELETE' }),

    getShares: (empId, year) => request(`/iras/shares/${empId}/${year}`),
    addShare: (data) => request('/iras/shares', { method: 'POST', body: JSON.stringify(data) }),
    deleteShare: (id) => request(`/iras/shares/${id}`, { method: 'DELETE' }),

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
    getSites: () => request('/sites'),
    createSite: (data) => request('/sites', { method: 'POST', body: JSON.stringify(data) }),
    updateSite: (id, data) => request(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSite: (id) => request(`/sites/${id}`, { method: 'DELETE' }),
    getSiteHours: (id) => request(`/sites/${id}/hours`),
    updateSiteHours: (id, data) => request(`/sites/${id}/hours`, { method: 'POST', body: JSON.stringify(data) }),

    getCustomers: () => request('/customers'),
    createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

    createDepartment: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
    updateDepartment: (id, data) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),

    getEmployeeGroups: () => request('/employee-groups'),
    createEmployeeGroup: (data) => request('/employee-groups', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployeeGroup: (id, data) => request(`/employee-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployeeGroup: (id) => request(`/employee-groups/${id}`, { method: 'DELETE' }),

    getEmployeeGrades: () => request('/employee-grades'),
    createEmployeeGrade: (data) => request('/employee-grades', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployeeGrade: (id, data) => request(`/employee-grades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployeeGrade: (id) => request(`/employee-grades/${id}`, { method: 'DELETE' }),

    // Holidays
    getHolidays: (year, month, entityId) => {
        let query = '';
        if (year) query += `year=${year}`;
        if (month) {
            if (query) query += '&';
            query += `month=${month}`;
        }
        if (entityId) {
            if (query) query += '&';
            query += `entityId=${entityId}`;
        }
        return request(`/holidays${query ? `?${query}` : ''}`);
    },
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
