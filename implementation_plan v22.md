# Bulk Employee Data Import by Entity

Implement a system to allow users to bulk import employee data using an Excel (XLSX/CSV) template. This will be scoped to the currently active entity.

## Proposed Changes

### Backend

#### [NEW] [Employee Import Endpoint](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Add `POST /api/employees/bulk-import` endpoint.
- Use [xlsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/test_timesheet.xlsx) library to parse uploaded files.
- Validate required fields (Full Name, Employee ID, Nationality, etc.).
- Ensure multi-entity constraints (Residents limited to 2 entities, Foreigners limited to 1).
- Auto-create associated KET and Leave Balance records for imported employees.

### Frontend

#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Add `importEmployees(formData)` function.

#### [NEW] [BulkImportModal.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/BulkImportModal.jsx)
- A reusable modal for uploading files and downloading the template.

#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)
- Integrate the `BulkImportModal`.
- Add "Bulk Import" button next to "Add Employee".

## Verification Plan

### Manual Verification
- Download the template and verify columns.
- Upload a sample file with valid data and verify employees are created.
- Verify that KET and Leave records are auto-generated.
- Test multi-entity constraints (e.g., trying to import a resident who is already in 2 entities).
- Verify that employees are assigned to the correct `entity_id`.
