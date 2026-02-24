# Implementation Plan - Branding with ezyHR Logo

Brand the application using the local [ezyhr-logo.png](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/ezyhr-logo.png) file to ensure a consistent corporate identity across the UI and generated documents.

## Proposed Changes

### [Component: Logo Size Reduction - Round 6]

#### [MODIFY] [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx)
- Sidebar: Reduce header container to `h-32`. Reduce logo to `h-24` (-40% from Round 4).
- Mobile Header: Ensure logo is suitably sized (around `h-16`).

#### [MODIFY] [Login.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Login.jsx)
- Reduce Login logo to `h-48` (-40% from Round 4).

### [Component: SPR Graduated CPF Rates]

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js) & DB Migration
- Add `pr_status_start_date` (DATE) to `employees` table.
- Add `cpf_full_rate_agreed` (BOOLEAN) to `employees` table.

#### [MODIFY] [cpf-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js)
- Define `SPR_GRADUATED_RATES` for Year 1 and Year 2.
- Update [calculateCPF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js#48-98) to accept `nationality`, `dateJoined` (or better `prStatusStartDate`), and `isFullRateAgreed`.
- Logic: If PR and Year < 3 and NOT `isFullRateAgreed`, use graduated rates.

#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx) (Frontend)
- Update Employee Edit/Add form to include PR Start Date and "Agreed to Full CPF" checkbox (only visible if Nationality is PR).

## Verification Plan

### Automated Tests
- Script to verify CPF output for:
    - Citizen (Full Rate)
    - Year 1 PR (Graduated Rate)
    - Year 1 PR (Full Rate agreed)

## Verification Plan

### Automated Tests
- None.

### Manual Verification
1. **Login Page**: Verify the logo is much more prominent.
2. **Sidebar**: Verify the logo is larger but still fits the design.
3. **Payslip UI**: Verify the logo is clearly visible in the header.
4. **Payslip PDF**: Export and verify the logo looks appropriately sized in the document.
