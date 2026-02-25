# Multi-Entity Profile Synchronization

Implement automated synchronization of personal profile details for employees registered under multiple entities.

## Proposed Changes

### [Component: API]
#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Update `PUT /api/employees/:id` to check if `national_id` is provided. If it is, perform a secondary `UPDATE` on all other rows in the `employees` table sharing that same `national_id`.
- Update `POST /api/employees` to check if the `national_id` already exists in the system. If it does, automatically merge personal details from the existing record into the new creation to ensure consistency from the start.

## Sync Logic Details

### Profile Fields (Synchronized)
- `full_name`
- `date_of_birth`
- `nationality`
- `tax_residency`
- `race`
- `gender`
- `language`
- `mobile_number`
- `whatsapp_number`
- `email`
- `highest_education`
- `photo_url`

### Employment Fields (Independent)
- `employee_id`
- `designation`
- `department`
- `employee_group`
- `employee_grade`
- `date_joined`
- `cessation_date`
- `basic_salary` & allowances/deductions
- `bank_name` & `bank_account`
- `status`
- `working_days_per_week` & work hours
- `site_id`

## Verification Plan

### Automated Tests
1. Edit Employee 2007 (Citizen) in Entity A, change their mobile number.
2. Verify that Employee 2007 in Entity B now has the same mobile number.
3. Verify that Entity-specific data like "Basic Salary" remains different between the two records.
