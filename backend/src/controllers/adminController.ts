import { Request, Response } from 'express';
import { db } from '../db';

export const adminController = {
  // Onboard new field staff, site engineers, or drivers
  addStaff: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, role, phone, password, username } = req.body;
      await db.query('INSERT INTO users (name, role, phone, password, username) VALUES (?, ?, ?, ?, ?)', [name, role, phone, password || 'pass123', username]);
      res.status(201).json({ success: true, message: 'Staff successfully registered.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateStaff: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, role, phone, password, username } = req.body;
      await db.query(
        'UPDATE users SET name = ?, role = ?, phone = ?, password = ?, username = ? WHERE id = ?',
        [name, role, phone, password, username, id]
      );
      res.status(200).json({ success: true, message: 'Staff successfully updated.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getStaff: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await db.query('SELECT * FROM users WHERE role != "Admin" ORDER BY id DESC');
      res.status(200).json(result.rows);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getSites: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await db.query(`
        SELECT s.*, u.name as supervisor_name 
        FROM sites s 
        LEFT JOIN users u ON s.supervisor_id = u.id 
        ORDER BY s.name ASC
      `);
      res.status(200).json(result.rows);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  createSite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, location } = req.body;
      await db.query('INSERT INTO sites (name, location) VALUES (?, ?)', [name, location]);
      res.status(201).json({ success: true, message: 'Site created successfully.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteSite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM sites WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Site deleted successfully.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteStaff: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM users WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Staff deleted successfully.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Deploy an existing supervisor to a specific construction site location
  allocateSite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { supervisorId, siteId } = req.body;
      await db.query('UPDATE sites SET supervisor_id = ? WHERE id = ?', [supervisorId, siteId]);
      res.status(200).json({ success: true, message: 'Supervisor allocation updated.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create a new sales or corporate business lead
  createLead: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, phone, projectNeeded, source, status } = req.body;
      await db.query(
        'INSERT INTO leads (name, phone, project_needed, source, status) VALUES (?, ?, ?, ?, ?)',
        [name, phone || null, projectNeeded, source, status || 'Hot Lead']
      );
      res.status(201).json({ success: true, message: 'CRM Lead record created.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Update lead status pipeline (e.g. change to 'Converted Client')
  updateLeadStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await db.query('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
      res.status(200).json({ success: true, message: 'Lead status adjusted.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getLeads: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getAttendanceOverview: async (req: Request, res: Response): Promise<void> => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const workerAttendance = await db.query(`
        SELECT 
          a.id,
          a.date,
          a.status,
          w.name as worker_name,
          w.role as worker_role,
          s.name as site_name,
          s.location as site_location
        FROM attendance a
        LEFT JOIN workers w ON a.worker_id = w.id
        LEFT JOIN sites s ON a.site_id = s.id
        WHERE a.date = ?
        ORDER BY s.name ASC, w.name ASC
      `, [date]);

      const supervisorAttendance = await db.query(`
        SELECT 
          sa.id,
          sa.date,
          sa.status,
          sa.selfie_url,
          sa.location_name,
          sa.latitude,
          sa.longitude,
          u.name as supervisor_name,
          u.role as supervisor_role,
          s.name as site_name,
          s.location as site_location
        FROM supervisor_attendance sa
        LEFT JOIN users u ON sa.user_id = u.id
        LEFT JOIN sites s ON sa.site_id = s.id
        WHERE sa.date = ?
        ORDER BY s.name ASC, u.name ASC
      `, [date]);

      res.status(200).json({
        date,
        workers: workerAttendance.rows,
        supervisors: supervisorAttendance.rows,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Compiles CRM metrics and site-by-site material/fuel logs for charts
  getAnalyticsOverview: async (req: Request, res: Response): Promise<void> => {
    try {
      const leadsMetrics = await db.query(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(IF(status = 'Converted Client', 1, NULL)) as converted_leads,
          source
        FROM leads GROUP BY source
      `);

      const expenseMatrix = await db.query(`
        SELECT 
          s.id,
          s.name as site_name,
          COALESCE(SUM(IF(l.category NOT IN ('Fuel', 'Petty Cash'), l.amount, 0)), 0) as material_costs,
          COALESCE(SUM(IF(l.category = 'Fuel', l.amount, 0)), 0) as fuel_costs,
          COALESCE(SUM(IF(l.category = 'Petty Cash', l.amount, 0)), 0) as petty_cash_costs,
          COALESCE(SUM(IF(l.payment_mode = 'Direct', l.amount, 0)), 0) as direct_expenses,
          COALESCE(SUM(IF(l.payment_mode = 'Indirect', l.amount, 0)), 0) as indirect_expenses,
          COALESCE(SUM(l.amount), 0) as total_expenses
        FROM sites s
        LEFT JOIN ledger l ON s.id = l.site_id AND l.type = 'DEBIT'
        GROUP BY s.id, s.name
      `);

      res.status(200).json({
        leadsChannelPerformance: leadsMetrics.rows,
        siteWiseExpenseBreakdown: expenseMatrix.rows
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
