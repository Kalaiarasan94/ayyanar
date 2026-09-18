CREATE DATABASE IF NOT EXISTS construction_erp;
USE construction_erp;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Supervisor', 'Driver', 'Site Engineer', 'Accounts', 'Owner', 'TotalAccounts') NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    supervisor_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    site_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('Present', 'Absent') DEFAULT 'Present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Ledger / Transactions table
CREATE TABLE IF NOT EXISTS ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    user_id INT NULL,
    type ENUM('CREDIT', 'DEBIT') NOT NULL,
    category VARCHAR(100),
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    payment_mode ENUM('Direct', 'Indirect') DEFAULT 'Direct',
    is_gst BOOLEAN DEFAULT FALSE,
    image_url TEXT NULL,
    date DATE NOT NULL,
    -- Indirect (credit) bills are settled later: they stay 'Pending' (no
    -- effect on the supervisor's cash balance) until an Admin/Owner approves
    -- the settlement, which registers the matching account_transactions OUT.
    -- Direct bills are 'Approved' immediately since cash already left.
    approval_status ENUM('Pending', 'Approved') DEFAULT 'Approved',
    approved_amount DECIMAL(15, 2) NULL,
    approved_date DATE NULL,
    approval_notes TEXT NULL,
    approved_by INT NULL,
    linked_transaction_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CRM Leads table
CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NULL,
    project_needed TEXT,
    source VARCHAR(255),
    status ENUM('Hot Lead', 'In Discussion', 'Converted Client') DEFAULT 'Hot Lead',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver Trip Records table (submitted from the driver login screen)
CREATE TABLE IF NOT EXISTS driver_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    vehicle_name VARCHAR(120) NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    starting_km DECIMAL(12, 2) NOT NULL,
    ending_km DECIMAL(12, 2) NOT NULL,
    total_km DECIMAL(12, 2) NOT NULL,
    distance VARCHAR(120) NULL,
    diesel_fare DECIMAL(12, 2) NULL,
    load_name VARCHAR(150) NULL,
    load_type ENUM('Rent', 'Own') DEFAULT 'Own',
    customer_name VARCHAR(150) NULL,
    place VARCHAR(150) NULL,
    load_weight VARCHAR(120) NULL,
    starting_time VARCHAR(50) NULL,
    ending_time VARCHAR(50) NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role Accounts table (money in/out ledgers for Admin, Supervisor and Owner)
CREATE TABLE IF NOT EXISTS account_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    linked_id INT NULL,
    role ENUM('Admin', 'Supervisor', 'Owner') NOT NULL,
    user_id INT NULL,
    entered_by_name VARCHAR(150) NULL,
    flow ENUM('IN', 'OUT') NOT NULL,
    category VARCHAR(100) NOT NULL,
    party_name VARCHAR(150) NULL,
    payment_method ENUM('Cash', 'Bank') DEFAULT 'Cash',
    description TEXT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site Allocations table
CREATE TABLE IF NOT EXISTS site_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    site_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (user_id, site_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Supervisor selfie clock-in attendance (Present/Absent + GPS + photo)
CREATE TABLE IF NOT EXISTS supervisor_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    site_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('Present', 'Absent') DEFAULT 'Present',
    selfie_url TEXT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    location_name VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    UNIQUE KEY (user_id, site_id, date)
);

-- Site progress photos uploaded by supervisors (with GPS)
CREATE TABLE IF NOT EXISTS site_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    user_id INT NOT NULL,
    image_url TEXT NOT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    location_name VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Diesel / fuel bills uploaded by drivers (photo + note + amount)
CREATE TABLE IF NOT EXISTS driver_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    driver_name VARCHAR(120) NOT NULL,
    vehicle_name VARCHAR(120) NULL,
    note TEXT NULL,
    amount DECIMAL(12, 2) NULL,
    image_url TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Worker attendance by category + headcount (e.g. "Kothanar" x 5 present)
-- instead of naming every individual worker. worker_name/image_url optionally
-- tag who reported it and attach a crew photo as proof.
CREATE TABLE IF NOT EXISTS attendance_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    present_count INT DEFAULT 0,
    absent_count INT DEFAULT 0,
    worker_name VARCHAR(255) NULL,
    image_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    UNIQUE KEY (site_id, date, category)
);

-- One combined daily site report per supervisor (mirrors the paper "Daily Sheet":
-- attendance, amount received, the 4 bill categories, and labour salary, all in one
-- submission). Attendance and labour-salary line items are stored as JSON text —
-- this is intentionally its own isolated record, not wired into the
-- attendance/accounts/bills tables.
CREATE TABLE IF NOT EXISTS daily_sheets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    work_description VARCHAR(255) NULL,
    attendance_json TEXT NULL,
    amount_received DECIMAL(12, 2) DEFAULT 0,
    bills_normal DECIMAL(12, 2) DEFAULT 0,
    bills_gst DECIMAL(12, 2) DEFAULT 0,
    bills_credit DECIMAL(12, 2) DEFAULT 0,
    vehicle_rental DECIMAL(12, 2) DEFAULT 0,
    labour_salary_json TEXT NULL,
    labour_salary_total DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert some initial data
INSERT INTO sites (name, location) VALUES 
('Alpha (Madurai)', 'Madurai'),
('Beta (Chennai)', 'Chennai'),
('Gamma (Trichy)', 'Trichy');

INSERT INTO users (username, name, role, phone, password) VALUES
('admin', 'Admin User', 'Admin', '1234567890', 'admin123'),
('super', 'Palani Kumar', 'Supervisor', '9876543210', 'super123'),
('driver', 'Selvam Arumugam', 'Driver', '8765432109', 'driver123'),
('accounts', 'Accounts Manager', 'Accounts', '7654321098', 'acc123'),
('owner', 'Company Owner', 'Owner', '0000000001', 'owner123'),
('totacc', 'Total Accounts', 'TotalAccounts', '0000000002', 'totacc123');
