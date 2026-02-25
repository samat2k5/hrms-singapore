# Filtering Leave Records by Entity and Enhancing PDF Reports

The goal is to ensure the Leave Management page only displays records for the currently selected entity and that PDF reports include a "Leave Balance as of: [Date]" label above the balance tables.

## Proposed Changes

### Backend

#### [MODIFY] [leave.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js)
- Update `GET /balances-all/:year` to filter employees by `entity_id` using `req.user.entityId`.
- Update `GET /requests` to join with `employees` table and filter by `entity_id`.

### Frontend

#### [MODIFY] [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx)
- Update [exportSummaryPDF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx#131-175) to insert the text "Leave Balance as of: [Date]" above the main summary table.
- Update [exportIndividualPDF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx#176-256) to insert the text "Leave Balance as of: [Date]" above the individual balance table.
- Ensure the date used is the current date (formatted appropriately).

## Verification Plan

### Automated Tests
- No automated tests available, will use manual verification.

### Manual Verification
- Log in and switch between different entities.
- Verify that the Leave Management page (Balances and Requests) updates to show only data for the selected entity.
- Generate a Summary PDF and an Individual PDF.
- Verify that the label "Leave Balance as of: [Date]" appears correctly above the balance tables in both PDFs.
