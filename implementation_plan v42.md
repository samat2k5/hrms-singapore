# Multi-File Attendance Import with Confirmation

This plan upgrades the Attendance Batch Import to support multiple files simultaneously, providing a safety check (record counting and validation) before final processing.

## Proposed Changes

### Backend

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- Change `upload.single('file')` to `upload.array('files')`.
- Wrap the import logic in a loop to process multiple files.
- Add support for `req.body.dryRun`:
    - If `true`, parse files and return record counts/validation results without saving to the database.
    - If `false`, proceed with database insertion as normal.
- Enhance the result object to return a summary suitable for multi-file batches.

### Frontend

#### [MODIFY] [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx)
- **State Management**:
    - Change `file` to `files` (array).
    - Add `scanResults` to store pre-import validation data.
    - Add `isScanning` and `isConfirmed` states for the workflow.
- **Improved UI**:
    - Multi-file selection support.
    - File list display with "Remove" buttons.
    - **Step 1: Scan**: A "Scan & Preview" button that triggers a dry-run.
    - **Step 2: Summary**: Display total files, total potential records, and warnings (e.g., unauthorized employee records found).
    - **Step 3: Confirm**: A "Confirm & Process Import" button revealed only after a successful scan.
- **Error Handling**: Display specific errors found during the scan phase per file.

## Verification Plan

### Manual Verification
- Select 2-3 different Excel attendance files.
- Verify the "Scan" phase correctly identifies the total number of records.
- Confirm that NO data is added to the database after just "Scanning".
- Confirm that data IS correctly added across all entities after "Confirming".
- Test with a file containing an unauthorized Employee ID and verify the error report.
