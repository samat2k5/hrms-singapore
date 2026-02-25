# Employee Photo Upload Enhancement

Goal: Allow HR/Admin to upload a professional photo for each employee through the Employee Form.

## Proposed Changes

### Database
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add a migration block for the `employees` table to add the `photo_url` column if it doesn't exist.

### Backend
#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Configure a new `multer` storage engine for employee photos (saving to `uploads/photos/`).
- Update the `POST /` and `PUT /:id` routes to accept `upload.single('photo')`.
- Save the relative file path in the `photo_url` column.

#### [MODIFY] [index.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/index.js)
- Ensure the `uploads/` directory is served statically (already done, but check).

### Frontend
#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Update employee creation and update methods to handle `FormData` instead of JSON when a photo is present.

#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx)
- Add a stylish photo upload section at the top of the form.
- Implement image preview logic.
- Switch to multipart/form-data submission when a photo is selected.

## Verification Plan
### Manual Verification
- Navigate to "Add Employee".
- Select a photo and verify the preview appears.
- Save the employee and verify the photo persists after a refresh.
- Edit an existing employee and change their photo.
- Verify the photo shows up (or can show up) in the employee list.
