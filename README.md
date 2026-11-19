# Staff Attendance System — HQ & Branches

Role-based web app for staff sign-in / sign-out, admin management, HR operations, QR scanning, GPS locations, and facial photo records.

## Quick Start

1. Open **`login.html`** in a browser (or serve the folder with a local server).
2. Use a demo account:

| Role  | Username | Password  | Access |
|-------|----------|-----------|--------|
| Admin | `admin`  | `admin123`| Full system |
| HR    | `hr`     | `hr123`   | Staff, credentials, reports, dashboard |
| Staff | `staff1` | `staff123`| Sign in / out only |
| Staff | `staff2` | `staff123`| Sign in / out only |

**Recommended:** run a local server for camera/QR support:
```bash
cd attendance-app
python -m http.server 8080
# Open http://localhost:8080/login.html
```

---

## Roles & Permissions

### Administrator
- Assign roles and manage all user credentials
- Register / modify / delete staff
- Assign staff location (GPS coordinates + facial photo)
- Manage branches
- View dashboard & generate reports
- System settings
- Sign in / out

### Human Resource (HR)
- Register staff, modify staff
- Manage credentials of all users
- Assign staff location (coordinates + facial photo)
- View dashboard
- Generate daily / weekly / monthly / quarterly reports
- Manage branches
- Sign in / out

### Normal Staff
- Sign in and sign out only (manual or QR scan)
- Account is locked to their linked staff profile

---

## Features

- **Login system** with session (localStorage)
- **QR code** scan for fast clock-in/out + printable staff badges
- **Facial photo** capture/upload per staff (stored with profile)
- **GPS coordinates** on staff and branches (manual or "Use Current GPS")
- **Dashboard** — present/absent/late KPIs, charts, currently signed-in
- **Reports** — Daily, Weekly, Monthly, Quarterly + CSV export
- **Multi-branch** — HQ + Nairobi, Mombasa, Kisumu, Eldoret (editable)

---

## File Structure

```
attendance-app/
├── login.html      ← Start here (login page)
├── index.html      ← Attendance (Sign In/Out) — all roles
├── admin.html      ← Admin / HR panel
├── auth.js         ← Authentication & roles
├── app.js          ← Attendance logic + QR
├── admin.js        ← Admin panel logic
└── README.md
```

---

## Pages Flow

```
login.html
    ├── admin / hr  →  admin.html  (dashboard, staff, users, branches, reports)
    │                      └── link to index.html for clock in/out
    └── staff       →  index.html  (Sign In / Out only)
```

Admin and HR can switch between Admin Panel and Attendance page freely.

---

## Notes

- All data is stored in the browser (localStorage). Clearing site data resets the app.
- Use the Export button (admin) to download a full JSON backup.
- Facial photos are resized and stored as JPEG data URLs (not full biometric matching).
- For production, replace localStorage with a real backend and proper password hashing.
