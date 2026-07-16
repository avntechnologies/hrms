# PeopleFlow HRMS

Enterprise multi-tenant HRMS in one repository.

```text
hrms/
|-- backend/   .NET 10, ASP.NET Core, EF Core, PostgreSQL
`-- frontend/  Angular 22, Angular Material, Tailwind CSS, SCSS
```

## Start locally

Use two terminals from the repository root:

```powershell
npm run backend
npm run frontend
```

The frontend is available at `http://localhost:4200`. Angular proxies `/api` to the backend at `http://localhost:5207`. Backend Swagger opens at `http://localhost:5207/swagger`.

The backend connection string, JWT key and bootstrap administrator are stored with .NET user-secrets under `hrms-backend-local-development`; no database password is committed.

The root backend scripts resolve the real backend directory before invoking .NET. This avoids a Windows Smart App Control false positive caused by compiling through a directory junction. On this machine, prefer `npm run backend` from the repository root.

## Employee onboarding and login

1. A tenant administrator creates the employee in **Organization > Employees**.
2. From that employee row's action menu, choose **Create login account**.
3. Use the employee's work email, set a temporary password, and assign **Employee Self-Service**.
4. Assign **People Manager** only when the employee manages direct reports. It already contains employee self-service permissions.
5. The employee signs in at `/login` using the company's tenant slug, work email, and temporary password.

A normal developer or individual contributor should receive **Employee Self-Service**, not HR Administrator. Menus and API access are both permission protected, so hiding a menu is never the only security boundary.

Employees can use **My workspace** and **My services** for attendance, leave, balances, timesheets, expenses, learning, performance, assigned assets, documents, announcements, payslips, and password changes. Managers additionally get **My team** for direct-report approvals and reviews.

## Location attendance

Clock-in and clock-out request browser geolocation only when the employee presses the action. Each event records latitude, longitude, reported accuracy, time, public IP, and user agent. Employees can see their own history; people managers can see only direct reports; authorized attendance administrators can see the tenant attendance register. Coordinate links open in OpenStreetMap.

Location is sensitive personal data. Before production use, configure a retention period, publish a clear attendance/privacy policy, collect any consent required in the customer's jurisdiction, and restrict export/access through tenant roles.

## Frontend capabilities

- Permission-aware employee, manager, tenant-administrator, and platform workspaces
- Employee account provisioning directly from the employee directory
- Daily GPS-backed clock-in/clock-out and attendance history
- Leave, time, expenses, learning, performance, assets, documents, announcements, and payslips
- Direct-report approvals for managers
- Dashboard, employees, organization, payroll, recruitment, audit, and operational administration
- Reusable data tables, pagination, filters, drawers, empty/loading/error states
- Angular Material with the Azure Material 3 theme; Tailwind CSS 4 and SCSS
- Tenant theme presets, custom colors, dark mode, density, and corner radius
- Automatic access-token refresh, refresh-token rotation, lockout, and session revocation

## Build and test

```powershell
npm run build
npm run test
```

See [backend/README.md](backend/README.md) for API architecture, migrations, Docker, and production guidance.
