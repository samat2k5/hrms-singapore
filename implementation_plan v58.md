# Biometric Uniqueness Validation

Goal: Prevent duplicate face enrollments by checking if a face is already registered to another employee.

## Proposed Changes

### Backend Logic
#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Update `PUT /api/employees/:id/face` to:
  - Fetch all existing `face_descriptor` entries for the current entity.
  - Compare the new descriptor against existing ones using Euclidean distance.
  - If a match is found (distance < 0.5), return a `400 Bad Request` with the name of the matched employee.
  - Otherwise, proceed to save the new descriptor.

## Verification Plan
### Manual Verification
- Attempt to enroll "Employee A" with a face.
- Attempt to enroll "Employee B" with the SAME face.
- Verify that a notification appears stating "Face is already enrolled for Employee A".
