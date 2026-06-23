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

  // Logs fuel fill details
  logFuel: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, odometer, cost, receiptUrl, date } = req.body;
      await db.query(
        'INSERT INTO fuel_logs (user_id, odometer, cost, receipt_url, date) VALUES (?, ?, ?, ?, ?)',
        [userId, odometer, cost, receiptUrl, date]
      );
      res.status(201).json({ success: true, message: 'Fuel log saved.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Logs trip details
  logTrip: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, vehicleNo, vehicleType, materialDetails, tollFee, date } = req.body;
      await db.query(
        'INSERT INTO trips (user_id, vehicle_no, vehicle_type, material_details, toll_fee, date) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, vehicleNo, vehicleType, materialDetails, tollFee, date]
      );
      res.status(201).json({ success: true, message: 'Trip log saved.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Submits an advance request
  requestAdvance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, amount, reason, date } = req.body;
      await db.query(
        'INSERT INTO advance_requests (user_id, amount, reason, date) VALUES (?, ?, ?, ?)',
        [userId, amount, reason, date]
      );
      res.status(201).json({ success: true, message: 'Advance request submitted.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Accounts marks advance as PAID and logs to ledger
  payAdvance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { requestId, siteId, userId, amount, date } = req.body;
      
      // 1. Update advance request status to PAID
      await db.query('UPDATE advance_requests SET status = "PAID" WHERE id = ?', [requestId]); 
      
      // 2. Insert CREDIT into ledger for that site and user
      await db.query(
        'INSERT INTO ledger (site_id, user_id, type, category, description, amount, date) VALUES (?, ?, "CREDIT", "Advance", "Cash received from Accounts", ?, ?)',
        [siteId, userId, amount, date]
      );

      res.status(200).json({ success: true, message: 'Advance amount disbursed and logged.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Saves daily supervisor attendance selfie log
  submitSupervisorAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, siteId, date, status, selfieUrl } = req.body;
      
      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      const cleanSiteId = siteId ? parseInt(siteId.toString()) : null;
      const cleanDate = date || new Date().toISOString().split('T')[0];
      const cleanStatus = status || 'Present';
      
      console.log('--- LOG SUPERVISOR ATTENDANCE ATTEMPT ---');
      console.log('Payload:', { cleanUserId, cleanSiteId, cleanDate, cleanStatus, selfieUrl: selfieUrl ? 'Present' : 'Missing' });
      
      const queryText = `
        INSERT INTO supervisor_attendance (user_id, site_id, date, status, selfie_url)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status), selfie_url = VALUES(selfie_url);
      `;
      await db.query(queryText, [cleanUserId, cleanSiteId, cleanDate, cleanStatus, selfieUrl || null]);
      
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