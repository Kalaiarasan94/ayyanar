-- Ayyanar Construction Database Reset Script
-- Clears transactional/site data only. Staff logins (users table) are left
-- completely untouched — no one's username or password is affected.

SET FOREIGN_KEY_CHECKS = 0;

-- Site-dependent tables first (these reference sites.id — must go before
-- sites is wiped and its AUTO_INCREMENT reset, or leftover rows would later
-- attach themselves to a brand-new, unrelated site reusing the same id)
DELETE FROM ledger;
ALTER TABLE ledger AUTO_INCREMENT = 1;

DELETE FROM daily_sheets;
ALTER TABLE daily_sheets AUTO_INCREMENT = 1;

DELETE FROM attendance_categories;
ALTER TABLE attendance_categories AUTO_INCREMENT = 1;

DELETE FROM site_allocations;
ALTER TABLE site_allocations AUTO_INCREMENT = 1;

DELETE FROM attendance;
ALTER TABLE attendance AUTO_INCREMENT = 1;

DELETE FROM supervisor_attendance;
ALTER TABLE supervisor_attendance AUTO_INCREMENT = 1;

DELETE FROM site_photos;
ALTER TABLE site_photos AUTO_INCREMENT = 1;

DELETE FROM driver_records;
ALTER TABLE driver_records AUTO_INCREMENT = 1;

DELETE FROM account_transactions;
ALTER TABLE account_transactions AUTO_INCREMENT = 1;

DELETE FROM leads;
ALTER TABLE leads AUTO_INCREMENT = 1;

DELETE FROM sites;
ALTER TABLE sites AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- users is NOT touched — every existing staff login (Admin, Supervisor,
-- Driver, Site Engineer, Accounts, Owner, TotalAccounts) stays exactly as is.
