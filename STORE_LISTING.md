# Store Listing Content — Ayyanar Construction CRM

This is copy-paste content for Google Play Console and Apple App Store Connect.
Fields marked **[FILL IN]** need real values only you have (support email/phone,
your developer account details, screenshots, signed builds).

## Public URLs (already live once this deploy ships)

- Landing page / Website: `https://apkayyanar.nexoraapp.in/`
- Privacy Policy: `https://apkayyanar.nexoraapp.in/privacy`
- Terms of Service: `https://apkayyanar.nexoraapp.in/terms`
- Support: `mailto:support@ayyanarconstruction.example` — **[FILL IN a real support email/phone in `backend/public/index.html`, `privacy.html`, `terms.html` before submitting]**

## App Identity

- **App name:** Ayyanar Construction CRM
- **Short description** (Play Store, ≤80 chars):
  `Attendance, expenses, driver logs & accounts for construction teams.`
- **Category:** Business (Play Store) / Business (App Store)
- **Keywords** (App Store, ≤100 chars, comma-separated, no spaces after commas):
  `construction,crm,attendance,site,expense,driver,accounts,supervisor,contractor,payroll`

## Full Description (Play Store & App Store, both accept up to ~4000 chars)

```
Ayyanar Construction CRM is the all-in-one operations app for construction companies —
built for Admins, Supervisors, Owners, Drivers and Accounts staff to run daily site work
and company finances from one place.

ATTENDANCE, VERIFIED
• Supervisors clock in with a selfie and GPS location.
• Worker headcounts are logged by category (Mason, Helper, Electrician, etc.) with an
  optional crew photo as proof.
• A monthly dashboard shows attendance rate and leave count at a glance.

ROLE-BASED ACCOUNTS
• Admin, Supervisor and Owner each keep their own cash book.
• Transfers between roles are automatically mirrored on both sides — no double entry.
• Month filters, category-wise breakdowns, and full transaction history.

SITE EXPENSE TRACKING
• Log material bills, petty cash, and site-wise spending with photo receipts.
• Direct vs. indirect expense breakdowns per site.
• Compare spending across every site at a glance.

DRIVER & TRIP LOGS
• Record vehicle trips, distance travelled and diesel bills.
• Vehicle-wise and driver-wise summaries.

ADMIN REPORTS DASHBOARD
• A dedicated web dashboard for Admins with day book, ledgers, monthly/yearly
  statements, attendance reports, and site-wise analytics with charts.

REPORTS THAT GO ANYWHERE
• Every report can be downloaded as a real PDF or shared directly to WhatsApp.

Ayyanar Construction CRM is an internal business tool intended for use by authorised
company staff only.
```

## Content Rating Questionnaire — what to expect

Both stores ask a questionnaire about app content. Based on what this app actually does:

- No violence, no user-generated public content, no gambling, no ads.
- The app **does** use the Camera (photo capture for attendance/bills) and **Location**
  (GPS at supervisor check-in) — declare these truthfully when asked; they should not
  raise the age rating (expect "Everyone" / "4+"), but they do require the data-safety
  disclosures below.

## Google Play — Data Safety section (draft answers)

Play Console requires a "Data safety" form. Based on what's actually collected:

| Data type | Collected? | Shared with 3rd parties? | Purpose |
|---|---|---|---|
| Name, phone number | Yes | No | Account identification, app functionality |
| Photos | Yes | No | Attendance proof, bill/receipt records |
| Precise location | Yes | No | Verifying supervisor check-in location |
| Financial info (transactions/amounts) | Yes | No | Company accounts & expense tracking |
| App activity (attendance/trip logs) | Yes | No | Core app functionality |

- Data is **not sold**, and is **not used for advertising**.
- Data is encrypted in transit (HTTPS) — confirm your Hostinger domain has SSL/HTTPS
  enabled, since Play Console asks this explicitly.
- Users can request deletion via the support contact in the Privacy Policy.

## Apple App Store — App Privacy ("Nutrition Label") — draft answers

Map to Apple's categories similarly: **Contact Info** (name, phone) linked to identity;
**User Content** (photos); **Location** (precise location, linked to identity, used for
app functionality, not for tracking); **Financial Info** (linked to identity, used for
app functionality). Answer "No" to data used for tracking across apps/websites (this app
does not do that).

## Assets checklist — **[YOU NEED TO PRODUCE THESE]**

I can't generate screenshots or capture real device images, so you'll need:

- **App icon:** 512×512 PNG (Play Store), 1024×1024 PNG (App Store), no transparency for iOS.
- **Feature graphic** (Play Store only): 1024×500 PNG/JPG.
- **Screenshots:** at least 2 per platform; Play Store wants phone screenshots (min
  320px, max 3840px, 16:9 or 9:16); App Store wants specific sizes per device
  (6.7", 6.5", 5.5" iPhone at minimum). Capture from the actual running app —
  Login, Home dashboard, Attendance, Accounts, and the Reports dashboard are good picks.
- **Promo video** (optional, both stores).

## Before you submit — checklist

- [ ] Replace the placeholder `support@ayyanarconstruction.example` email in
      `backend/public/index.html`, `privacy.html`, and `terms.html` with a real address.
- [ ] Confirm `https://apkayyanar.nexoraapp.in` has a valid SSL certificate (required by both stores).
- [ ] Set `UPLOADS_ROOT_DIR` in hPanel so uploaded photos survive future deploys (see `backend/.env.example`).
- [ ] Produce the app icon, feature graphic, and screenshots listed above.
- [ ] Build and sign the release APK/AAB (Android) and archive (iOS) — this app is an
      Expo project, so use `eas build` (EAS) for both platforms if you haven't already.
- [ ] Paste the Full Description, Short Description, and Keywords above into the
      respective console fields.
- [ ] Paste the Privacy Policy URL and Support URL/email into Play Console's
      "App content" section and App Store Connect's "App Information" section.
- [ ] Complete the Data Safety (Play) / App Privacy (App Store) forms using the tables
      above as a starting point — you're legally responsible for their accuracy.

**Note:** the Privacy Policy and Terms pages I wrote are a solid starting template based
on exactly what this app collects, but since it handles location and financial data,
it's worth having them reviewed by someone with legal expertise for your specific
jurisdiction before publishing to a public app store.
