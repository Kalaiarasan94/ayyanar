import { Request, Response } from 'express';
import { db } from '../db';

export const fieldController = {
  // Logs site-wise material bills or daily petty cash expenditures
  logExpense: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId, userId, type, category, description, amount, date, paymentMode, isGst, imageUrl } = req.body;
      
      // Defensive: Ensure IDs are numbers
      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      
      console.log('--- LOG EXPENSE ATTEMPT ---');
      console.log('Payload:', { cleanSiteId, cleanUserId, type, category, amount, paymentMode, imageUrl: imageUrl ? 'Present' : 'Missing' });
      
      const queryText = `
        INSERT INTO ledger (site_id, user_id, type, category, description, amount, date, payment_mode, is_gst, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      await db.query(queryText, [
        cleanSiteId, 
        cleanUserId, 
        type, 
        category, 
        description, 
        amount, 
        date, 
        paymentMode || 'Direct', 
        isGst ? 1 : 0,
        imageUrl || null
      ]);

      // If the bill is Direct (Cash) and uploaded by a supervisor/user,
      // automatically record it in account_transactions to reduce their cash balance.
      if (paymentMode === 'Direct' && cleanUserId) {
        const userRes = await db.query('SELECT role FROM users WHERE id = ?', [cleanUserId]);
        const siteRes = await db.query('SELECT name FROM sites WHERE id = ?', [cleanSiteId]);
        
        if (userRes.rows.length > 0 && siteRes.rows.length > 0) {
          const userRole = userRes.rows[0].role;
          const siteName = siteRes.rows[0].name;
          
          await db.query(
            `INSERT INTO account_transactions (role, user_id, flow, category, party_name, payment_method, description, amount, date)
             VALUES (?, ?, 'OUT', 'Site Expenses', ?, 'Cash', ?, ?, ?)`,
            [
              userRole,
              cleanUserId,
              siteName,
              description || 'Direct Bill Payment',
              parseFloat(amount.toString()),
              date || new Date().toISOString().split('T')[0]
            ]
          );
        }
      }
      
      res.status(201).json({ success: true, message: 'Expense saved to MySQL.' });
    } catch (error: any) {
      console.error('logExpense Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Updates a material/petty-cash bill entry in the ledger
  updateExpense: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { category, description, amount, paymentMode, date } = req.body;
      await db.query(
        'UPDATE ledger SET category = ?, description = ?, amount = ?, payment_mode = ?, date = ? WHERE id = ?',
        [category, description || null, amount, paymentMode || 'Direct', date, id]
      );
      res.status(200).json({ success: true, message: 'Bill updated.' });
    } catch (error: any) {
      console.error('updateExpense Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Deletes a material/petty-cash bill entry from the ledger
  deleteExpense: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM ledger WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Bill deleted.' });
    } catch (error: any) {
      console.error('deleteExpense Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Fetches transaction logs for a specific site, optionally filtered by date
  getLedgerBySite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      const dateFilter = req.query.date as string | undefined;
      console.log(`--- FETCHING LEDGER FOR SITE ${siteId} ${dateFilter ? `on ${dateFilter}` : '(all dates)'} ---`);

      let query = `SELECT l.*, u.name AS supervisor_name 
         FROM ledger l 
         LEFT JOIN users u ON l.user_id = u.id 
         WHERE l.site_id = ?`;
      const params: any[] = [siteId];

      if (dateFilter) {
        query += ' AND l.date = ?';
        params.push(dateFilter);
      }
      query += ' ORDER BY l.date DESC, l.id DESC';

      const result = await db.query(query, params);
      console.log(`Found ${result.rows.length} rows for site ${siteId}`);
      
      res.status(200).json(result.rows);
    } catch (error: any) {
      console.error('getLedgerBySite Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getSupervisorWallet: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      console.log(`--- CALCULATING WALLET FOR USER ${userId} ---`);
      
      // REFINED LOGIC: 
      // Cash in Hand = Total CREDITs - Total 'Direct' DEBITs.
      // 'Indirect' DEBITs (Credit/Vendor bills) do NOT reduce physical cash in hand.
      const result = await db.query(`
        SELECT 
          COALESCE(SUM(IF(type = 'CREDIT', amount, 0)), 0) as total_credits,
          COALESCE(SUM(IF(type = 'DEBIT' AND (payment_mode = 'Direct' OR payment_mode IS NULL), amount, 0)), 0) as total_debits
        FROM ledger WHERE user_id = ?
      `, [userId]);
      
      console.log('Wallet Query Result:', result.rows);

      if (!result.rows || result.rows.length === 0) {
        res.status(200).json({ 
          userId,
          cashInHand: 0,
          totalCredits: 0,
          totalDebits: 0
        });
        return;
      }
      
      const { total_credits, total_debits } = result.rows[0];
      const cashInHand = Number(total_credits) - Number(total_debits);
      
      console.log(`Final Calc - User ${userId}: Credits=${total_credits}, Debits=${total_debits}, CashInHand=${cashInHand}`);

      res.status(200).json({ 
        userId,
        cashInHand: cashInHand,
        totalCredits: total_credits,
        totalDebits: total_debits
      });
    } catch (error: any) {
      console.error('getSupervisorWallet Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getSupervisorSites: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const result = await db.query('SELECT * FROM sites WHERE supervisor_id = ?', [userId]);
      res.status(200).json(result.rows);
    } catch (error: any) {
      console.error('getSupervisorSites Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves daily worker attendance lists from the field.
  // Accepts { siteId, date, workers: [{ name, role, status }] } — each worker is
  // found or created in the workers table so real names reach the admin report.
  submitAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId, date, workers, records } = req.body;

      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      if (!cleanSiteId) {
        res.status(400).json({ success: false, error: 'A valid siteId is required.' });
        return;
      }
      const cleanDate = date || new Date().toISOString().split('T')[0];

      if (Array.isArray(workers) && workers.length > 0) {
        for (const w of workers) {
          if (!w?.name) continue;
          // Find or create the worker by name + role
          const found = await db.query('SELECT id FROM workers WHERE name = ? AND role = ? LIMIT 1', [w.name, w.role || 'Worker']);
          let workerId = found.rows[0]?.id;
          if (!workerId) {
            const inserted = await db.query('INSERT INTO workers (name, role) VALUES (?, ?)', [w.name, w.role || 'Worker']);
            workerId = (inserted.rows as any).insertId;
          }
          await db.query(
            'INSERT INTO attendance (site_id, worker_id, date, status) VALUES (?, ?, ?, ?)',
            [cleanSiteId, workerId, cleanDate, w.status === 'Absent' ? 'Absent' : 'Present']
          );
        }
        res.status(201).json({ success: true, message: `Attendance saved for ${workers.length} worker(s).` });
        return;
      }

      // Legacy payload: records of { workerId, status, date }
      for (const item of records || []) {
        await db.query(
          'INSERT INTO attendance (site_id, worker_id, date, status) VALUES (?, ?, ?, ?)',
          [cleanSiteId, item.workerId, item.date || cleanDate, item.status]
        );
      }
      res.status(201).json({ success: true, message: 'Attendance logs synchronized.' });
    } catch (error: any) {
      console.error('submitAttendance Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lists the worker attendance already submitted for one site on one date
  getAttendanceBySite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const result = await db.query(
        `SELECT a.id, a.status, a.date, w.name AS worker_name, w.role AS worker_role
         FROM attendance a
         JOIN workers w ON a.worker_id = w.id
         WHERE a.site_id = ? AND a.date = ?
         ORDER BY a.id DESC`,
        [siteId, date]
      );
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getAttendanceBySite Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves worker headcount by category for a site+date (e.g. "Kothanar" x 5 present,
  // 1 absent) instead of naming every individual worker. Upserts per category/date.
  submitAttendanceCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId, date, categories } = req.body;
      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      if (!cleanSiteId) {
        res.status(400).json({ success: false, error: 'A valid siteId is required.' });
        return;
      }
      const cleanDate = date || new Date().toISOString().split('T')[0];
      if (!Array.isArray(categories) || categories.length === 0) {
        res.status(400).json({ success: false, error: 'At least one worker category is required.' });
        return;
      }

      for (const c of categories) {
        if (!c?.category) continue;
        await db.query(
          `INSERT INTO attendance_categories (site_id, date, category, present_count, absent_count, worker_name, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE present_count = VALUES(present_count), absent_count = VALUES(absent_count), worker_name = VALUES(worker_name), image_url = VALUES(image_url)`,
          [
            cleanSiteId,
            cleanDate,
            c.category,
            parseInt(c.presentCount || 0),
            parseInt(c.absentCount || 0),
            c.workerName || null,
            c.imageUrl || null,
          ]
        );
      }
      res.status(201).json({ success: true, message: `Attendance saved for ${categories.length} category/categories.` });
    } catch (error: any) {
      console.error('submitAttendanceCategory Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lists the category-wise attendance already submitted for one site on one date
  getAttendanceCategoryBySite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const result = await db.query(
        'SELECT * FROM attendance_categories WHERE site_id = ? AND date = ? ORDER BY id DESC',
        [siteId, date]
      );
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getAttendanceCategoryBySite Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves a driver's daily trip record from the driver login screen
  saveDriverRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId, vehicleName, driverName, startingKm, endingKm,
        distance, dieselFare, loadName, loadType, customerName,
        place, loadWeight, startingTime, endingTime, date
      } = req.body;

      if (!vehicleName || !driverName || startingKm === undefined || endingKm === undefined) {
        res.status(400).json({ success: false, error: 'vehicleName, driverName, startingKm and endingKm are required.' });
        return;
      }

      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      const start = parseFloat(startingKm.toString());
      const end = parseFloat(endingKm.toString());

      if (isNaN(start) || isNaN(end)) {
        res.status(400).json({ success: false, error: 'startingKm and endingKm must be numbers.' });
        return;
      }

      // Total KM is always derived on the server so it can never be spoofed
      const totalKm = Math.abs(end - start);
      const cleanLoadType = loadType === 'Rent' ? 'Rent' : 'Own';

      console.log('--- SAVE DRIVER RECORD ATTEMPT ---');
      console.log('Payload:', { cleanUserId, vehicleName, driverName, start, end, totalKm, cleanLoadType });

      await db.query(
        `INSERT INTO driver_records
          (user_id, vehicle_name, driver_name, starting_km, ending_km, total_km, distance,
           diesel_fare, load_name, load_type, customer_name, place, load_weight,
           starting_time, ending_time, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanUserId,
          vehicleName,
          driverName,
          start,
          end,
          totalKm,
          distance || null,
          dieselFare !== undefined && dieselFare !== null && dieselFare !== '' ? parseFloat(dieselFare.toString()) : null,
          loadName || null,
          cleanLoadType,
          cleanLoadType === 'Rent' ? (customerName || null) : null,
          place || null,
          loadWeight || null,
          startingTime || null,
          endingTime || null,
          date || new Date().toISOString().split('T')[0]
        ]
      );

      res.status(201).json({ success: true, message: 'Driver record saved.', totalKm });
    } catch (error: any) {
      console.error('saveDriverRecord Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Updates a driver trip record (admin correction)
  updateDriverRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        vehicleName, driverName, startingKm, endingKm,
        distance, dieselFare, loadName, loadType, customerName,
        place, loadWeight, startingTime, endingTime, date
      } = req.body;

      const start = parseFloat(startingKm.toString());
      const end = parseFloat(endingKm.toString());
      if (isNaN(start) || isNaN(end)) {
        res.status(400).json({ success: false, error: 'startingKm and endingKm must be numbers.' });
        return;
      }
      const totalKm = Math.abs(end - start);
      const cleanLoadType = loadType === 'Rent' ? 'Rent' : 'Own';

      await db.query(
        `UPDATE driver_records SET
           vehicle_name = ?, driver_name = ?, starting_km = ?, ending_km = ?, total_km = ?,
           distance = ?, diesel_fare = ?, load_name = ?, load_type = ?, customer_name = ?,
           place = ?, load_weight = ?, starting_time = ?, ending_time = ?, date = ?
         WHERE id = ?`,
        [
          vehicleName, driverName, start, end, totalKm,
          distance || null,
          dieselFare !== undefined && dieselFare !== null && dieselFare !== '' ? parseFloat(dieselFare.toString()) : null,
          loadName || null, cleanLoadType,
          cleanLoadType === 'Rent' ? (customerName || null) : null,
          place || null, loadWeight || null, startingTime || null, endingTime || null,
          date, id
        ]
      );
      res.status(200).json({ success: true, message: 'Driver record updated.', totalKm });
    } catch (error: any) {
      console.error('updateDriverRecord Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Deletes a driver trip record
  deleteDriverRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM driver_records WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Driver record deleted.' });
    } catch (error: any) {
      console.error('deleteDriverRecord Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves a diesel/fuel bill uploaded by a driver (photo + note on which bill it is)
  saveDriverBill: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, driverName, vehicleName, note, amount, imageUrl, date } = req.body;
      if (!driverName || !imageUrl) {
        res.status(400).json({ success: false, error: 'driverName and imageUrl are required.' });
        return;
      }
      await db.query(
        `INSERT INTO driver_bills (user_id, driver_name, vehicle_name, note, amount, image_url, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId ? parseInt(userId.toString()) : null,
          driverName,
          vehicleName || null,
          note || null,
          amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount.toString()) : null,
          imageUrl,
          date || new Date().toISOString().split('T')[0]
        ]
      );
      res.status(201).json({ success: true, message: 'Diesel bill uploaded.' });
    } catch (error: any) {
      console.error('saveDriverBill Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Fetches driver-uploaded bills for admin reports (optional ?from&to)
  getDriverBills: async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query;
      let sql = 'SELECT * FROM driver_bills';
      const params: any[] = [];
      if (from && to) {
        sql += ' WHERE date BETWEEN ? AND ?';
        params.push(from, to);
      } else if (from) {
        sql += ' WHERE date >= ?';
        params.push(from);
      } else if (to) {
        sql += ' WHERE date <= ?';
        params.push(to);
      }
      sql += ' ORDER BY date DESC, id DESC';
      const result = await db.query(sql, params);
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getDriverBills Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Deletes a driver diesel bill
  deleteDriverBill: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM driver_bills WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Diesel bill deleted.' });
    } catch (error: any) {
      console.error('deleteDriverBill Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Fetches driver trip records for admin reports (optional ?from=YYYY-MM-DD&to=YYYY-MM-DD)
  getDriverRecords: async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query;
      let sql = 'SELECT * FROM driver_records';
      const params: any[] = [];

      if (from && to) {
        sql += ' WHERE date BETWEEN ? AND ?';
        params.push(from, to);
      } else if (from) {
        sql += ' WHERE date >= ?';
        params.push(from);
      } else if (to) {
        sql += ' WHERE date <= ?';
        params.push(to);
      }

      sql += ' ORDER BY date DESC, id DESC';
      const result = await db.query(sql, params);
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getDriverRecords Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves daily supervisor attendance selfie log with GPS location
  submitSupervisorAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, siteId, date, status, selfieUrl, latitude, longitude, locationName } = req.body;

      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      const cleanDate = date || new Date().toISOString().split('T')[0];
      const cleanStatus = status || 'Present';
      const cleanLat = latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude.toString()) : null;
      const cleanLng = longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude.toString()) : null;

      console.log('--- LOG SUPERVISOR ATTENDANCE ATTEMPT ---');
      console.log('Payload:', { cleanUserId, cleanSiteId, cleanDate, cleanStatus, selfieUrl: selfieUrl ? 'Present' : 'Missing', cleanLat, cleanLng, locationName });

      const queryText = `
        INSERT INTO supervisor_attendance (user_id, site_id, date, status, selfie_url, latitude, longitude, location_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          selfie_url = VALUES(selfie_url),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          location_name = VALUES(location_name);
      `;
      await db.query(queryText, [
        cleanUserId, cleanSiteId, cleanDate, cleanStatus,
        selfieUrl || null, cleanLat, cleanLng, locationName || null,
      ]);

      res.status(201).json({ success: true, message: 'Supervisor attendance logged successfully.' });
    } catch (error: any) {
      console.error('submitSupervisorAttendance Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves daily supervisor site check-in progress photo
  uploadSitePhoto: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId, userId, imageUrl, latitude, longitude, locationName } = req.body;
      
      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      
      console.log('--- LOG SITE PHOTO ATTEMPT ---');
      console.log('Payload:', { cleanUserId, cleanSiteId, imageUrl: imageUrl ? 'Present' : 'Missing', latitude, longitude, locationName });
      
      const queryText = `
        INSERT INTO site_photos (site_id, user_id, image_url, latitude, longitude, location_name)
        VALUES (?, ?, ?, ?, ?, ?);
      `;
      await db.query(queryText, [
        cleanSiteId,
        cleanUserId,
        imageUrl,
        latitude !== undefined && latitude !== null ? parseFloat(latitude.toString()) : null,
        longitude !== undefined && longitude !== null ? parseFloat(longitude.toString()) : null,
        locationName || null
      ]);
      
      res.status(201).json({ success: true, message: 'Site progress photo saved successfully.' });
    } catch (error: any) {
      console.error('uploadSitePhoto Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get recent site photos uploaded by supervisors
  getRecentSitePhotos: async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('--- FETCHING RECENT SITE PHOTOS ---');
      const queryText = `
        SELECT sp.*, s.name as site_name, u.name as supervisor_name
        FROM site_photos sp
        JOIN sites s ON sp.site_id = s.id
        JOIN users u ON sp.user_id = u.id
        ORDER BY sp.created_at DESC, sp.id DESC
        LIMIT 20;
      `;
      const result = await db.query(queryText);
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getRecentSitePhotos Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves one combined "Daily Sheet" — attendance, amount received, the 4 bill
  // categories, and labour salary for a site on a given day, submitted by a
  // supervisor. Kept as its own isolated record (not wired into the
  // attendance/accounts/bills tables) — it mirrors the paper daily sheet as-is.
  submitDailySheet: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        siteId, userId, date, workDescription,
        attendance, billsNormal, billsGst, billsCredit, vehicleRental,
        labourSalary,
      } = req.body;

      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      if (!cleanSiteId || !cleanUserId || !date) {
        res.status(400).json({ success: false, error: 'Site, supervisor and date are required.' });
        return;
      }

      const labourSalaryTotal = (labourSalary || []).reduce(
        (sum: number, l: any) => sum + (parseFloat(l.amount) || 0),
        0
      );
      const totalAmount =
        (parseFloat(billsNormal) || 0) +
        (parseFloat(billsGst) || 0) +
        (parseFloat(billsCredit) || 0) +
        (parseFloat(vehicleRental) || 0) +
        labourSalaryTotal;

      await db.query(
        `INSERT INTO daily_sheets
          (site_id, user_id, date, work_description, attendance_json, amount_received,
           bills_normal, bills_gst, bills_credit, vehicle_rental, labour_salary_json,
           labour_salary_total, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanSiteId,
          cleanUserId,
          date,
          workDescription || null,
          JSON.stringify(attendance || []),
          0,
          parseFloat(billsNormal) || 0,
          parseFloat(billsGst) || 0,
          parseFloat(billsCredit) || 0,
          parseFloat(vehicleRental) || 0,
          JSON.stringify(labourSalary || []),
          labourSalaryTotal,
          totalAmount,
        ]
      );

      // Automatically post OUT transaction into that particular supervisor's accounts output!
      if (totalAmount > 0) {
        let siteName = 'Site';
        let supervisorName: string | null = null;
        try {
          const siteRes = await db.query('SELECT name FROM sites WHERE id = ?', [cleanSiteId]);
          if (siteRes.rows?.[0]?.name) siteName = siteRes.rows[0].name;
        } catch {}
        try {
          const userRes = await db.query('SELECT name FROM users WHERE id = ?', [cleanUserId]);
          if (userRes.rows?.[0]?.name) supervisorName = userRes.rows[0].name;
        } catch {}

        await db.query(
          `INSERT INTO account_transactions 
            (role, user_id, entered_by_name, flow, category, party_name, payment_method, description, amount, date)
           VALUES ('Supervisor', ?, ?, 'OUT', 'Daily Sheet', ?, 'Cash', ?, ?, ?)`,
          [
            cleanUserId,
            supervisorName,
            siteName,
            workDescription ? `Daily Sheet (${siteName}) - ${workDescription}` : `Daily Sheet (${siteName})`,
            totalAmount,
            date,
          ]
        );
      }

      res.status(201).json({ success: true, message: 'Daily sheet saved and added to supervisor account statement.' });
    } catch (error: any) {
      console.error('submitDailySheet Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Fetches submitted daily sheets for a site, optionally filtered by date, with
  // the attendance/labour-salary JSON parsed back into arrays for the client.
  getDailySheetsBySite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      const { date } = req.query;
      let queryText = `
        SELECT ds.*, s.name as site_name, u.name as supervisor_name
        FROM daily_sheets ds
        JOIN sites s ON ds.site_id = s.id
        JOIN users u ON ds.user_id = u.id
        WHERE ds.site_id = ?
      `;
      const params: any[] = [siteId];
      if (date) {
        queryText += ' AND ds.date = ?';
        params.push(date);
      }
      queryText += ' ORDER BY ds.date DESC, ds.id DESC';
      const result = await db.query(queryText, params);
      const rows = (result.rows || []).map((r: any) => ({
        ...r,
        attendance: (() => {
          try { return JSON.parse(r.attendance_json || '[]'); } catch { return []; }
        })(),
        labourSalary: (() => {
          try { return JSON.parse(r.labour_salary_json || '[]'); } catch { return []; }
        })(),
      }));
      res.status(200).json(rows);
    } catch (error: any) {
      console.error('getDailySheetsBySite Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};