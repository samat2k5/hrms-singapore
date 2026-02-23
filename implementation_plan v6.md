# Payroll Context Updates

## Goal
Process payroll specifically for the selected employee group AND the business entity active in the left panel. Currently, the backend processes payroll based solely on the `employee_group` string and ignores the active entity context.

## Proposed Changes

### Database
#### [MODIFY] server/db/init.js
- Update [createSchema](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js#44-304) to include `entity_id INTEGER NOT NULL` in the `payroll_runs` table definition.
- Add `FOREIGN KEY (entity_id) REFERENCES entities(id)` to the `payroll_runs` table.

#### [NEW] server/db/migrate-payroll.js (Temporary Script)
- Create and run a one-time migration script using `sql.js` to execute `ALTER TABLE payroll_runs ADD COLUMN entity_id INTEGER DEFAULT 1` and save the database to preserve existing data.

### Backend APIs
#### [MODIFY] server/routes/payroll.js
- **POST /api/payroll/run**:
  - Enforce `req.user.entityId` presence.
  - Insert `req.user.entityId` into the new `entity_id` column when creating a `payroll_run`.
  - Filter the employee selection query `WHERE employee_group = ? AND entity_id = ?`.
- **GET /api/payroll/runs**:
  - Filter the results to only show runs belonging to the `req.user.entityId`.
- **GET /run/:id** and **DELETE /run/:id**:
  - Ensure operations only succeed if the run's `entity_id` matches `req.user.entityId`.

### Frontend
#### [MODIFY] client/src/pages/Payroll.jsx
- Import `useAuth` to observe changes to `activeEntity.id`.
- Add `activeEntity.id` to the dependency array of `useEffect` to reload payroll runs dynamically when the active entity changes in the left panel.
- Replace the hardcoded `'General', 'Executive', ...` groups dropdown with dynamic groups fetched from the backend using `api.getEmployeeGroups()`. This ensures the group selection correctly reflects the active entity's groups.

## Verification Plan

### Automated Tests
Currently, there doesn't appear to be an automated test suite (e.g. Jest setup) for this module. The backend relies solely heavily on local `npm run dev` and manual verification. Therefore, we rely on manual verification but will provide a detailed guide.

### Manual Verification
1. Run the database migration script.
2. Ensure both the frontend and backend servers are running.
3. Using the browser/UI:
   - Navigate to the **Payroll** tab.
   - Select the first entity ("Acme Corp Tech") in the left pane. Note the visible payroll runs and select a group (e.g., "Executive"). 
   - Click "Run Payroll". Verify the success toast, and only employees belonging to this entity and group are processed.
   - Switch to the second entity ("Acme Corp Services") via the left pane. Verify the page updates: showing a different history of payroll runs and a different set of dropdown groups.
   - Run payroll for the second entity and confirm only those respective employees appear in the payslip results.
