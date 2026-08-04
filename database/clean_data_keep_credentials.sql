-- ============================================================
-- CLEAN SLATE SCRIPT
-- Wipes every operational record (sites, ledger, accounts, driver
-- trips/bills, attendance, leads, site photos) while keeping the
-- `users` table completely untouched — every login (Admin,
-- Supervisor, Driver, Site Engineer, Accounts, Owner, TotalAccounts,
-- and any staff the admin created) still works exactly as before.
--
-- Run this in phpMyAdmin on the Hostinger database when you want a
-- fresh start before going live with real data.
-- AUTO_INCREMENT counters reset to 1 automatically (TRUNCATE behavior).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE attendance;
TRUNCATE TABLE attendance_categories;
TRUNCATE TABLE workers;
TRUNCATE TABLE ledger;
TRUNCATE TABLE leads;
TRUNCATE TABLE driver_records;
TRUNCATE TABLE driver_bills;
TRUNCATE TABLE account_transactions;
TRUNCATE TABLE supervisor_attendance;
TRUNCATE TABLE site_photos;
TRUNCATE TABLE site_allocations;
TRUNCATE TABLE sites;

SET FOREIGN_KEY_CHECKS = 1;

-- `users` table is intentionally NOT touched — all credentials remain.
