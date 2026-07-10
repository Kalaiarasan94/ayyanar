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
      
      res.status(201).json({ success: true, message: 'Expense saved to MySQL.' });
    } catch (error: any) {
      console.error('logExpense Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Fetches transaction logs for a specific site
  getLedgerBySite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      console.log(`--- FETCHING LEDGER FOR SITE ${siteId} ---`);
      
      const result = await db.query('SELECT * FROM ledger WHERE site_id = ? ORDER BY date DESC, id DESC', [siteId]);
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

  // Saves daily worker attendance lists from the field
  submitAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { siteId, records } = req.body; // records is an array of { workerId, status, date }
      
      for (const item of records) {
        await db.query(
          'INSERT INTO attendance (site_id, worker_id, date, status) VALUES (?, ?, ?, ?)',
          [siteId, item.workerId, item.date, item.status]
        );
      }
      res.status(201).json({ success: true, message: 'Attendance logs synchronized.' });
    } catch (error: any) {
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
  }
};