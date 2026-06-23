import mysql from 'mysql2/promise';

// Configure your local MySQL database connection details here
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',             // Default MySQL username
  password: '',                 // Default PHPMyAdmin/XAMPP password is empty
  database: 'construction_erp',
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
  }
};