# Employee Self Service (ESS) — Build Plan

A new, separate Lovable project (not built inside e-Reminder). Mobile-first, installable PWA for a single company. Modules: Leave & approvals, Attendance, Payslips & tax, Expense claims. You'll provide company-specific details (name, org structure, roles, leave/attendance policy, payroll cycle) once the new project exists.

## Important: this is a new project

I cannot create a new Lovable project from inside the e-Reminder project. Once you approve this plan, you'll start a new Lovable project (New App), and I'll rebuild it there following this plan. The design, schema, modules, and flows below carry over as-is.

## First step: design directions

Before any code, I'll render 3 clickable design concepts tuned for an enterprise-but-friendly HR tool (clean, high-contrast, large type; options like a calm slate/teal, a warm corporate amber, or a crisp blue). You pick one; everything is built in that style.

## Phase 1 — Foundation & accounts

- Lovable Cloud backend (database, auth, storage, server functions).
- Sign-up/login: Email + password, Google sign-in. Admin-invited onboarding for employees/managers (no open self-signup).
- Onboarding: employee profile (name, employee ID, department, manager, joining date, contact).
- Roles: `employee`, `manager`, `admin`, `hr` — stored in a separate `user_roles` table (never on the profile). Managers can approve leave/expense for their direct reports; HR/admin can manage everything.
- Org structure: `departments`, `employees` (extends auth user with manager_id self-reference), `reporting_chain`.
- Bottom tab shell: Home, Leave, Attendance, Payslips, Profile. (Manager actions surface inline.)

## Phase 2 — Leave & approvals

- Leave types configured by HR/admin (casual, sick, earned, unpaid, etc.) with per-type balances and carry-forward rules.
- Leave request: dates (with half-day), type, reason, attachment (medical cert), delegated contact.
- Approval workflow: employee submits → manager approves/rejects → balance auto-adjusted. Multi-level optional (manager → HR) for long leaves.
- Leave calendar (team view for managers; personal calendar for employees), balance widget on Home.
- Holiday list maintained by HR; conflict checks against holidays/weekends.

## Phase 3 — Attendance

- Clock-in/out with timestamp; optional location capture (GPS pin) and/or IP for workplace attendance.
- Missed-punch regularisation request → manager approval.
- Monthly attendance grid (present/absent/leave/half-day/late) with summary stats (days present, late ins, total hours).
- Grace-time and shift configuration by admin (late threshold, core hours).

## Phase 4 — Payslips & tax

- Admin/HR uploads monthly payslip PDF per employee (stored in Lovable Cloud Storage, access-locked to owner + admin).
- Employee views/downloads current and past payslips, sorted by pay period.
- Form 16 / annual tax document upload and download.
- Tax declaration form (regime choice, investments under 80C/80D, rent for HRA) — submitted by employee, visible to payroll.
- No payroll calculation engine in v1 — payslip values are provided by HR; the app is a delivery + declaration surface.

## Phase 5 — Expense claims

- Employee submits expense claim: type (travel, food, stay, misc), date, amount, description, receipt upload.
- Multi-line claim (several receipts in one submission) with itemised totals.
- Approval workflow: employee → manager → HR/finance; finance marks "reimbursed" with payout reference.
- Status timeline: submitted → approved → reimbursed (or rejected at any stage), with per-step actor and timestamp.

## Phase 6 — Manager self-service & admin

- Manager dashboard: pending approvals (leave, attendance regularisation, expense), team attendance today, team leave calendar.
- HR/admin: employee directory, org chart, bulk holiday upload, leave-type/attendance policy config, payslip upload, role assignment.
- Announcement/notice board (admin publishes; employees see on Home; read receipts).

## Phase 7 — Engagement & polish

- Notifications: email + WhatsApp/SMS (MSG91, reusing your existing account/templates) for submission, approval, payslip publish, announcement.
- Profile: avatar, contact update (HR-approved), notification preferences, light/dark/system theme, language (English + Hindi, i18n structure ready for more).
- Calendar export (ICS) for leave + holidays, like e-Reminder's subscription feed.

## Technical notes

- Stack: TanStack Start (React + TypeScript), Tailwind, Lovable Cloud (Postgres + auth + storage), server functions for all backend logic. Installable PWA (manifest-only home-screen support unless offline is requested).
- Schema sketch: `profiles`, `employees`, `departments`, `leave_types`, `leave_balances`, `leave_requests`, `holidays`, `attendance_punches`, `attendance_regularisations`, `payslips`, `tax_documents`, `tax_declarations`, `expense_claims`, `expense_claim_items`, `announcements`, `user_roles` (separate roles table). Row-level security scopes every table to owner / manager-in-chain / HR-admin.
- Payments: none in v1 (reimbursement is marked manually by finance).
- MSG91: reuse your existing account; I'll list the exact WhatsApp/SMS templates needed at Phase 7.
- Auth: Google + email/password by default; phone OTP optional later (needs MSG91 SMS).

## Suggested order of delivery

Phases 1–4 (a usable ESS for employees + managers), then 5 (expenses), then 6–7 (admin + engagement). You'll review after each phase.

## What I need from you next

- Company details (name, departments, reporting structure, leave policy, attendance/shift rules, payroll cycle) — either now or at Phase 1.
- Whether to include phone OTP sign-in now or keep email + Google.
