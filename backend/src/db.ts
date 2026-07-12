import mysql from 'mysql2/promise';
import { logError } from './logger';

// Connection settings come from environment variables in production (Hostinger hPanel);
// the defaults below keep local XAMPP development working with zero setup.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'construction_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const db = {
  /**
   * Helper utility to execute queries.
   * mysql2 returns an array: [rows, fields]. We return just the rows to keep usage clean.
   */
  query: async (sql: string, params?: any[]): Promise<any> => {
    try {
      const [rows] = await pool.execute(sql, params);
      return { rows: rows as any[] };
    } catch (error) {
      console.error('Database Query Error:', { sql, params, error });
      logError(`SQL: ${sql.trim().slice(0, 90)}`, error);
      throw error;
    }
  }
};

export const initDb = async () => {
  try {
    // 1. Create supervisor_attendance table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS supervisor_attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          site_id INT NOT NULL,
          date DATE NOT NULL,
          status ENUM('Present', 'Absent') DEFAULT 'Present',
          selfie_url TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
          UNIQUE KEY (user_id, site_id, date)
      );
    `);

    // Create site_photos table if not exists
    await db.query(`
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
    `);

    // Create driver_records table if not exists (daily trip log submitted from driver login)
    await db.query(`
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
    `);

    // Create account_transactions table (role-wise money in/out ledgers for Admin, Supervisor, Owner)
    await db.query(`
      CREATE TABLE IF NOT EXISTS account_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role ENUM('Admin', 'Supervisor', 'Owner') NOT NULL,
          user_id INT NULL,
          flow ENUM('IN', 'OUT') NOT NULL,
          category VARCHAR(100) NOT NULL,
          party_name VARCHAR(150) NULL,
          payment_method ENUM('Cash', 'Bank') DEFAULT 'Cash',
          description TEXT NULL,
          amount DECIMAL(15, 2) NOT NULL,
          date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add party_name to account_transactions (the specific person behind a category,
    // e.g. which real supervisor a payment went to) if it doesn't exist yet
    const [partyColResult] = await pool.execute("SHOW COLUMNS FROM account_transactions LIKE 'party_name'");
    if ((partyColResult as any[]).length === 0) {
      await db.query('ALTER TABLE account_transactions ADD COLUMN party_name VARCHAR(150) NULL AFTER category;');
      console.log('Added party_name column to account_transactions.');
    }

    // Add payment_method (Cash / Bank) to account_transactions if it doesn't exist yet
    const [pmColResult] = await pool.execute("SHOW COLUMNS FROM account_transactions LIKE 'payment_method'");
    if ((pmColResult as any[]).length === 0) {
      await db.query("ALTER TABLE account_transactions ADD COLUMN payment_method ENUM('Cash', 'Bank') DEFAULT 'Cash' AFTER party_name;");
      console.log('Added payment_method column to account_transactions.');
    }

    // Add phone to leads if it doesn't exist yet
    const [leadPhoneResult] = await pool.execute("SHOW COLUMNS FROM leads LIKE 'phone'");
    if ((leadPhoneResult as any[]).length === 0) {
      await db.query('ALTER TABLE leads ADD COLUMN phone VARCHAR(20) NULL AFTER name;');
      console.log('Added phone column to leads.');
    }

    // Extend users.role enum with Owner and TotalAccounts, then seed their logins
    const [roleColResult] = await pool.execute("SHOW COLUMNS FROM users LIKE 'role'");
    const roleCols = roleColResult as any[];
    if (roleCols.length > 0 && !roleCols[0].Type.includes('Owner')) {
      await db.query(`
        ALTER TABLE users MODIFY COLUMN role
        ENUM('Admin', 'Supervisor', 'Driver', 'Site Engineer', 'Accounts', 'Owner', 'TotalAccounts') NOT NULL;
      `);
      console.log('Extended users.role enum with Owner and TotalAccounts.');
    }
    await db.query(`
      INSERT IGNORE INTO users (username, name, role, phone, password) VALUES
      ('owner', 'Company Owner', 'Owner', '0000000001', 'owner123'),
      ('totacc', 'Total Accounts', 'TotalAccounts', '0000000002', 'totacc123');
    `);

    // 2. Add status column to sites if it doesn't exist
    const [columnsResult] = await pool.execute("SHOW COLUMNS FROM sites LIKE 'status'");
    const columns = columnsResult as any[];
    
    if (columns.length === 0) {
      await db.query(`
        ALTER TABLE sites ADD COLUMN status VARCHAR(50) DEFAULT 'Active';
      `);
      // Update the second site to Completed to show it off in the comparison grid
      await db.query(`
        UPDATE sites SET status = 'Completed' WHERE name LIKE '%Beta%';
      `);
      console.log('Added status column to sites and set Beta (Chennai) as Completed.');
    }

    // 3. Add latitude, longitude, and location_name columns to supervisor_attendance table if they don't exist
    const [latResult] = await pool.execute("SHOW COLUMNS FROM supervisor_attendance LIKE 'latitude'");
    const latCols = latResult as any[];
    if (latCols.length === 0) {
      await db.query(`
        ALTER TABLE supervisor_attendance 
        ADD COLUMN latitude DECIMAL(10, 8) NULL,
        ADD COLUMN longitude DECIMAL(11, 8) NULL,
        ADD COLUMN location_name VARCHAR(255) NULL;
      `);
      console.log('Added latitude, longitude, and location_name columns to supervisor_attendance.');
    }
    
    console.log('MySQL Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    logError('Database initialization (initDb)', error);
  }
};