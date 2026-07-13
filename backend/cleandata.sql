-- Ayyanar Construction Database Reset Script
-- Disables constraints, wipes all tables, resets auto-increments, and creates the default admin user.

SET FOREIGN_KEY_CHECKS = 0;

-- Wipe all transactional and metadata tables using DELETE FROM (bypasses constraint blockages)
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

DELETE FROM users;
ALTER TABLE users AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed the system with the essential Administrator account
INSERT INTO users (username, name, role, phone, password)
VALUES ('admin', 'System Administrator', 'Admin', '0000000000', 'admin123');
