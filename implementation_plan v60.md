# Face Attendance Premium Notifications

Goal: Replace basic notifications in the Face Attendance Time Clock with premium SweetAlert2 toasts.

## Proposed Changes

### Frontend Logic
#### [MODIFY] [FaceAttendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/FaceAttendance.jsx)
- Import `Swal` from `sweetalert2`.
- Define a `Toast` mixin with:
  - `toast: true`
  - `position: 'top-end'`
  - `showConfirmButton: false`
  - `timer: 3000`
  - `timerProgressBar: true`
  - Custom glassmorphism styling for background and text.
- Replace `toast.success` and `toast.error` calls with `Toast.fire`.

## Verification Plan
### Manual Verification
- Open the Face Attendance page.
- Enroll a face (if not already done).
- Perform a clock-in/out using the face scanner.
- Verify the notification appears as a premium toast in the top-right corner with a progress bar and glassmorphism styling.
