# Implementation Plan - Branding with ezyHR Logo

Brand the application using the local [ezyhr-logo.png](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/ezyhr-logo.png) file to ensure a consistent corporate identity across the UI and generated documents.

## Proposed Changes

### [Component: Resizing Branding - Round 2]

#### [MODIFY] [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx)
- Sidebar: Increase container height from `h-20` to `h-28`. Increase logo height from `h-16` to `h-24`.
- Mobile Header: Increase logo height from `h-14` to `h-20`.

#### [MODIFY] [Login.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Login.jsx)
- Increase Login logo height from `h-32` to `h-48`.

#### [MODIFY] [Payslip.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx)
- **UI**: Increase logo height from `h-16` to `h-24`.
- **PDF Export**: Increase logo dimensions in PDF from `45, 22` to `65, 32`.

## Verification Plan

### Automated Tests
- None.

### Manual Verification
1. **Login Page**: Verify the logo is much more prominent.
2. **Sidebar**: Verify the logo is larger but still fits the design.
3. **Payslip UI**: Verify the logo is clearly visible in the header.
4. **Payslip PDF**: Export and verify the logo looks appropriately sized in the document.
