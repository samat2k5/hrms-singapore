import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Entities from './pages/Entities'
import Departments from './pages/Departments'
import EmployeeGroups from './pages/EmployeeGroups'
import EmployeeGrades from './pages/EmployeeGrades'
import Holidays from './pages/Holidays'
import Employees from './pages/Employees'
import EmployeeForm from './pages/EmployeeForm'
import EmployeeKETs from './pages/EmployeeKETs'
import EmployeeDocuments from './pages/EmployeeDocuments'
import Leave from './pages/Leave'
import LeavePolicies from './pages/LeavePolicies'
import Attendance from './pages/Attendance'
import Payroll from './pages/Payroll'
import Payslip from './pages/Payslip'
import Reports from './pages/Reports'
import Users from './pages/Users'
import UserRoles from './pages/UserRoles'
import Customers from './pages/Customers'
import Sites from './pages/Sites'
import ShiftSettings from './pages/ShiftSettings'

import { useEffect, useState } from 'react'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading: authLoading, setEntities, switchEntity, activeEntity, logout } = useAuth()
  const [entitiesLoading, setEntitiesLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      setEntitiesLoading(true);
      import('./services/api').then(({ default: api }) => {
        api.getEntities()
          .then(data => {
            if (data.length === 0) {
              console.error("User has no assigned entities. Logging out.");
              logout();
              return;
            }
            setEntities(data);
            if (!activeEntity && data.length > 0) {
              switchEntity(data[0]);
            }
          })
          .catch(err => console.error('Failed to load entities', err))
          .finally(() => setEntitiesLoading(false));
      });
    }
  }, [isAuthenticated, activeEntity]);

  if (authLoading || entitiesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="entities" element={<Entities />} />
        <Route path="departments" element={<Departments />} />
        <Route path="employee-groups" element={<EmployeeGroups />} />
        <Route path="employee-grades" element={<EmployeeGrades />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="shift-settings" element={<ShiftSettings />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/add" element={<EmployeeForm />} />
        <Route path="employees/edit/:id" element={<EmployeeForm />} />
        <Route path="employees/:id/kets" element={<EmployeeKETs />} />
        <Route path="employees/:id/documents" element={<EmployeeDocuments />} />
        <Route path="leave" element={<Leave />} />
        <Route path="leave-policies" element={<LeavePolicies />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="payroll/payslip/:id" element={<Payslip />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="user-roles" element={<UserRoles />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sites" element={<Sites />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
