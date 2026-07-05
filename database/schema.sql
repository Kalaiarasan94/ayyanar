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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CRM Leads table
CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
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
    role ENUM('Admin', 'Supervisor', 'Owner') NOT NULL,
    user_id INT NULL,
    flow ENUM('IN', 'OUT') NOT NULL,
    category VARCHAR(100) NOT NULL,
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
