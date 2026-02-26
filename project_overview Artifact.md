# HRMS Singapore Project Overview

This document provides a technical summary of the HRMS Singapore project, covering architecture, database design, and key features.

## Architecture Overview

The project follows a modern full-stack architecture:
- **Frontend**: A React application built with Vite, featuring a responsive, dark-mode glassmorphism UI.
- **Backend**: An Express.js server providing a modular API.
- **Database**: SQLite (managed via `sql.js`), synced to a local file (`hrms.sqlite`).

### Key Directories
- `client/src`: React components, pages, context providers, and API services.
- `server/`: Express routes, database initialization, and calculation engines.
- `uploads/`: Storage for employee photos and identity documents.

---

## Technical Stack

- **Core**: React 19, JavaScript (ES6+), Node.js.
- **Styling**: Vanilla CSS with custom properties for theming.
- **State Management**: React Context (e.g., `AuthContext`).
- **PDF Generation**: `jspdf` and `jspdf-autotable`.
- **Database**: SQLite (via `sql.js`).
- **Authentication**: JWT-based (stored in LocalStorage).

---

## Feature Modules

### 1. Employee Management
- Comprehensive employee profiles (Personal, Employment, Banking).
- Multi-entity support with cross-entity transfers.
- Face biometric registration and attendance clocking.
- Document tracking with expiry notifications.

### 2. Key Employment Terms (KET) & MOM Compliance
- Generation of bi-lingual employment agreements (English + Tamil/Mandarin/Malay).
- Auto-translation of key fields.
- Automated generation of Singapore MOM-compliant KET PDFs.

### 3. Payroll Engine
- Period-based payroll runs with support for MOM and CPF regulations.
- Automated calculation of CPF, SDL, and SHG (CDAC, ECF, MBMF, SINDA).
- Support for fixed and custom allowances/deductions.
- Bulk attendance-based payroll processing.

### 4. Leave Management
- MOM-compliant leave entitlements (Annual, Sick, Hospitalization, Maternity, etc.).
- Dynamic entitlement/earned calculations based on proration rules.
- Manager approval workflow for leave requests.

### 5. Attendance & Reporting
- Face attendance clock-in/out.
- High-performance attendance grid with sticky headers.
- Compliance reports: CPF, SDL, SHG, and IRAS (IR8A, AIS).

---

## API Service Layer

The frontend communicates via a centralized `api.js` service, ensuring consistent headers for authentication and multi-entity context (`Entity-Id`).

### Authentication & Authorization
- Role-based access control (Admin, HR, Operations Admin).
- JWT-protected private routes.

---

## Database Schema Highlights

- **`employees`**: Core employee data including PR status and face descriptors.
- **`payroll_runs` & `payslips`**: History of all payroll cycles.
- **`employee_kets`**: Stores employment contract terms and translations.
- **`iras_forms`**: Persistence for generated IRAS compliance data.
- **`shift_settings_v2`**: Configuration for complex shift and penalty logic.
