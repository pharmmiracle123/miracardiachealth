# MiracardiacHealth – World-Class Hospital Management System

**Telemedicine · Full Standard HMS · Pharmacy · Medical Education · Counseling**

MiracardiacHealth is a mobile-first, Firebase-powered healthcare platform expanded into a **complete Standard Hospital Management System** designed for surgeons, physicians, nurses, laboratory scientists, radiologists, pharmacists, administrators, health counselors, and every hospital department.

It aims to be among the best practical tools for improving healthcare delivery in Nigeria and globally — combining telemedicine, inpatient care, diagnostics, theatre safety, nursing workflows, billing, inventory, quality & safety, and continuous professional education.

---

## What's included

### Patient-facing
- Register / Login (Email + Google)
- Find doctors, book appointments, pay consultations (Paystack)
- Secure doctor–patient chat (text + images)
- Online pharmacy search, cart & orders
- Nearby health services map
- Health counseling access
- Medical Student Hub (courses, CME-style resources)
- Profile & support tickets

### Staff account creation (important)

- **Public Sign up** (`Register.html`) creates **Patient / Student** accounts only.
- **Doctors, pharmacists, nurses, lab, support, counselors, etc.** are created **only by Admin** from **Admin Dashboard → Users → Add Staff**.
- The form captures role, department, name, email, phone, temporary password, and role-specific fields (specialty, photo, license for doctors; pharmacy details for pharmacists).
- Firebase Auth + Firestore user profile are created together; doctor/pharmacy documents are written when relevant.


### Full Standard Hospital Management System (HMS Hub)

| Module | File | Who it's for |
|--------|------|----------------|
| **HMS Hub** | `hms-hub.html` | All staff – central navigation |
| **Electronic Medical Records** | `emr.html` | Doctors, nurses, surgeons – full chart (vitals, problems, meds, notes, orders, allergies, documents) |
| **Inpatient & Wards** | `inpatient.html` | Bed board, admit / transfer / discharge, occupancy |
| **Surgery / OT** | `surgery-ot.html` | Theatre scheduling, **WHO Surgical Safety Checklist**, status tracking |
| **Nursing Station** | `nursing.html` | Care plans, MAR (medication administration), SBAR handover, tasks |
| **Emergency & Triage** | `emergency.html` | ESI triage levels, rapid registration, ED board |
| **Laboratory** | `laboratory.html` | Lab orders, specimen status, results, **critical value** flags |
| **Radiology & Imaging** | `radiology.html` | X-ray / CT / MRI / US requests |
| **Pathology** | `pathology.html` | Specimen & histopathology orders |
| **Hospital Pharmacy** | `pharmacist.html` | Existing pharmacy management + formulary |
| **Inventory & Stores** | `inventory.html` | Stock, expiry, reorder levels, CSSD |
| **Billing & Invoicing** | `billing.html` | Itemized invoices, insurance/payer, paid/unpaid |
| **Staff & HR** | `staff-hr.html` | Staff directory, roles, departments |
| **Analytics & Reports** | `analytics.html` | Occupancy, lab/OT/invoice volume, KPI focus areas |
| **Quality & Safety** | `quality-safety.html` | Incident reporting (medication error, falls, HAI, near miss…) |
| **Health Counseling** | `counseling.html` | Mental health & lifestyle sessions, risk assessment, goals |
| **Clinical Guidelines** | `clinical-guidelines.html` | Evidence-based decision support (sepsis, malaria, ACS, stroke, DKA, anaphylaxis, etc.) |
| **Discharge & Follow-up** | `discharge.html` | Discharge summaries, meds, follow-up plans |
| **Referrals & Consults** | `referrals.html` | Internal / external specialist referrals |
| **Admin** | `admin.html` | Approvals, platform settings, branding |

---

## Designed to improve care delivery

- **Role-based dashboards** – doctors, nurses, surgeons, pharmacists, admins and support each see the tools they need first.
- **WHO Surgical Safety Checklist** built into the OT module (Sign In / Time Out / Sign Out).
- **Allergy banner** on every EMR chart.
- **Critical lab values** highlighted for immediate escalation.
- **ESI triage** in Emergency for prioritisation.
- **Medication Administration Record (MAR)** with 5-Rights mindset.
- **SBAR / ISBAR** structured nursing handover.
- **Counseling module** with risk levels and escalation prompts.
- **Clinical guidelines** covering high-impact conditions relevant to LMIC and global practice.
- **Quality & incident reporting** for continuous improvement.
- Mobile-first, offline-capable (Firestore persistence), NDPR-aware.

---

## Tech stack

- Static HTML + Tailwind CSS (CDN) + vanilla ES modules
- Firebase Auth, Firestore, Storage
- Cloudinary (optional image upload)
- Paystack (consultations & pharmacy)
- PWA-ready (`manifest.json`, `sw.js`)

---

## Deploy / setup (after downloading this zip)

1. Extract and upload to GitHub Pages (or any static host).
2. **Firestore Rules** – paste `firestore.rules` into Firebase Console → Firestore → Rules → **Publish**.
3. **Storage Rules** – paste `storage.rules` if using Storage.
4. Authentication → enable **Email/Password** and **Google**.
5. Authorized domains – add your GitHub Pages / custom domain.
6. In `js/config.js` set your **Paystack public key** when ready.
7. Admin emails are listed in `firestore.rules` (`adminEmails()`). Edit if needed.

---

## Testing checklist (core + HMS)

- [ ] Register / Login (email + Google) → Dashboard
- [ ] Doctor registration → Admin approval → appears on Find a Doctor
- [ ] Consultation payment → Admin approval → chat active
- [ ] Book appointment
- [ ] Pharmacist adds drug → patient search & order
- [ ] **HMS Hub** opens for clinical/admin roles
- [ ] EMR: search patient, record vitals, problem, med, note, order, allergy
- [ ] Inpatient: bed board loads (seeds default beds), admit / discharge
- [ ] Surgery: schedule case, complete WHO checklist
- [ ] Nursing: MAR entry, care plan, handover
- [ ] Emergency: triage with ESI level
- [ ] Lab: place order, enter result, mark critical
- [ ] Counseling: new session with risk level
- [ ] Billing: create invoice, mark paid
- [ ] Guidelines: search and open sepsis / malaria / ACS etc.
- [ ] Analytics: occupancy and counts reflect live data

---

## Roles suggested for staff

| Role value in `users.role` | Typical access |
|----------------------------|----------------|
| `patient` | Telemedicine, pharmacy, counseling, student hub |
| `doctor` | EMR, OT, labs, wards, guidelines, appointments |
| `surgeon` | OT board, EMR, wards |
| `nurse` | Nursing station, EMR, wards, emergency |
| `pharmacist` | Pharmacy + inventory |
| `lab` / `radiologist` | Lab / imaging modules |
| `counselor` | Counseling |
| `support` | Tickets + counseling |
| `admin` | Everything + analytics, billing, HR, quality |

Promote users via Admin panel or by setting `role` (and `status: "active"`) in Firestore.

---

## Important notices

- This platform **supports** clinical work; it is **not a substitute for emergency care**, licensed clinical judgment, or institutional protocols.
- Always verify drug doses, local antimicrobial resistance, and national guidelines.
- High-risk counseling flags require local emergency / senior clinician pathways.
- Comply with NDPR and your facility's data protection policy.
- In production, further tighten Firestore rules, enable App Check, and use proper secret management for any server-side keys.

---

## File map (new HMS files)

```
hms-hub.html              ← Central HMS navigation
emr.html                  ← Full electronic medical record
inpatient.html            ← Ward / bed management
surgery-ot.html           ← Theatre + WHO checklist
nursing.html              ← Nursing station
emergency.html            ← ESI triage & ED board
laboratory.html           ← Lab orders & critical values
radiology.html            ← Imaging requests
pathology.html            ← Pathology orders
inventory.html            ← Hospital stores
billing.html              ← Invoicing
staff-hr.html             ← Staff directory
analytics.html            ← Operational KPIs
quality-safety.html       ← Incident reports
counseling.html           ← Health counseling
clinical-guidelines.html  ← Decision support
discharge.html            ← Discharge summaries
referrals.html            ← Referrals
```

Plus the original telemedicine, pharmacy, student hub, admin, and support pages.

---

**Built for MiracardiacHealth · Mobile-first · Full Standard HMS · Designed to help every department deliver better care.**

Not a substitute for emergency care. Use under professional responsibility and local regulations.
