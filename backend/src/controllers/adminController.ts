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

  updateSite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, location } = req.body;
      await db.query('UPDATE sites SET name = ?, location = ? WHERE id = ?', [name, location, id]);
      res.status(200).json({ success: true, message: 'Site updated successfully.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteSite: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      // Safely unlink or clean up child table references so foreign keys don't block deletion
      try { await db.query('UPDATE ledger SET site_id = NULL WHERE site_id = ?', [id]); } catch {}
      try { await db.query('UPDATE attendance SET site_id = NULL WHERE site_id = ?', [id]); } catch {}
      try { await db.query('UPDATE supervisor_attendance SET site_id = NULL WHERE site_id = ?', [id]); } catch {}
      try { await db.query('UPDATE site_photos SET site_id = NULL WHERE site_id = ?', [id]); } catch {}
      try { await db.query('DELETE FROM site_allocations WHERE site_id = ?', [id]); } catch {}
      try { await db.query('DELETE FROM daily_sheets WHERE site_id = ?', [id]); } catch {}

      await db.query('DELETE FROM sites WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Project site deleted successfully.' });
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

  // Full lead edit (name, phone, requirement, source) — status is edited separately above
  updateLead: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, phone, projectNeeded, source } = req.body;
      await db.query(
        'UPDATE leads SET name = ?, phone = ?, project_needed = ?, source = ? WHERE id = ?',
        [name, phone || null, projectNeeded, source, id]
      );
      res.status(200).json({ success: true, message: 'Lead updated.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteLead: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM leads WHERE id = ?', [id]);
      res.status(200).json({ success: true, message: 'Lead deleted.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getLeads: async (req: Request, res: Response): Promise<void> => {
    try {
      const dateParam = req.query.date as string | undefined;
      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;

      let sql = 'SELECT * FROM leads';
      const params: any[] = [];
      if (dateParam) {
        sql += ' WHERE DATE(created_at) = ?';
        params.push(dateParam);
      } else if (fromParam && toParam) {
        sql += ' WHERE DATE(created_at) BETWEEN ? AND ?';
        params.push(fromParam, toParam);
      } else if (fromParam) {
        sql += ' WHERE DATE(created_at) >= ?';
        params.push(fromParam);
      } else if (toParam) {
        sql += ' WHERE DATE(created_at) <= ?';
        params.push(toParam);
      }
      sql += ' ORDER BY created_at DESC';

      const result = await db.query(sql, params);
      res.status(200).json(result.rows);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getAttendanceOverview: async (req: Request, res: Response): Promise<void> => {
    try {
      const dateParam = req.query.date as string | undefined;
      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;
      const allTime = req.query.all === '1' || req.query.all === 'true';
      const supervisorId = req.query.supervisorId;

      // Exact date wins (default, used by every existing caller); otherwise a
      // from/to range; otherwise, unless "all time" was explicitly asked for
      // (?all=1), fall back to today so old callers that pass nothing keep
      // seeing today's snapshot exactly as before.
      let dateClause = '';
      let dateParams: any[] = [];
      if (!allTime) {
        if (dateParam) {
          dateClause = ' = ?';
          dateParams = [dateParam];
        } else if (fromParam && toParam) {
          dateClause = ' BETWEEN ? AND ?';
          dateParams = [fromParam, toParam];
        } else if (fromParam) {
          dateClause = ' >= ?';
          dateParams = [fromParam];
        } else if (toParam) {
          dateClause = ' <= ?';
          dateParams = [toParam];
        } else {
          dateClause = ' = ?';
          dateParams = [new Date().toISOString().split('T')[0]];
        }
      }
      const dateFilter = (col: string) => (dateClause ? ` AND ${col}${dateClause}` : '');

      let workerQuery = `
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
        WHERE 1=1${dateFilter('a.date')}
      `;
      const workerParams: any[] = [...dateParams];
      if (supervisorId) {
        workerQuery += ' AND s.supervisor_id = ?';
        workerParams.push(parseInt(supervisorId.toString()));
      }
      workerQuery += ' ORDER BY a.date DESC, s.name ASC, w.name ASC';

      const workerAttendance = await db.query(workerQuery, workerParams);

      // Category-wise worker headcount (e.g. "Kothanar" x 5 present) — the
      // current worker attendance model, replacing the old per-name rows above
      let categoryQuery = `
        SELECT
          ac.id,
          ac.date,
          ac.category,
          ac.present_count,
          ac.absent_count,
          ac.worker_name,
          ac.image_url,
          s.name as site_name,
          s.location as site_location,
          u.name as site_supervisor_name
        FROM attendance_categories ac
        LEFT JOIN sites s ON ac.site_id = s.id
        LEFT JOIN users u ON s.supervisor_id = u.id
        WHERE 1=1${dateFilter('ac.date')}
      `;
      const categoryParams: any[] = [...dateParams];
      if (supervisorId) {
        categoryQuery += ' AND s.supervisor_id = ?';
        categoryParams.push(parseInt(supervisorId.toString()));
      }
      categoryQuery += ' ORDER BY ac.date DESC, s.name ASC, ac.category ASC';

      const categoryAttendance = await db.query(categoryQuery, categoryParams);

      let supervisorQuery = `
        SELECT
          sa.id,
          sa.date,
          sa.status,
          sa.selfie_url,
          sa.location_name,
          sa.latitude,
          sa.longitude,
          sa.created_at,
          u.name as supervisor_name,
          u.role as supervisor_role,
          s.name as site_name,
          s.location as site_location
        FROM supervisor_attendance sa
        LEFT JOIN users u ON sa.user_id = u.id
        LEFT JOIN sites s ON sa.site_id = s.id
        WHERE 1=1${dateFilter('sa.date')}
      `;
      const supervisorParams: any[] = [...dateParams];
      if (supervisorId) {
        supervisorQuery += ' AND sa.user_id = ?';
        supervisorParams.push(parseInt(supervisorId.toString()));
      }
      supervisorQuery += ' ORDER BY sa.date DESC, u.name ASC';

      const supervisorAttendance = await db.query(supervisorQuery, supervisorParams);

      res.status(200).json({
        date: dateParam || (allTime || fromParam || toParam ? null : new Date().toISOString().split('T')[0]),
        workers: workerAttendance.rows || [],
        categories: categoryAttendance.rows || [],
        supervisors: supervisorAttendance.rows || [],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Compiles CRM metrics and site-by-site material/fuel logs for charts
  // Optional ?from=/?to= — narrows both the leads-by-source counts and the
  // site expense breakdown to that range; omitted filters mean lifetime.
  getAnalyticsOverview: async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query;
      const leadsWhere: string[] = [];
      const leadsParams: any[] = [];
      if (from) { leadsWhere.push('DATE(created_at) >= ?'); leadsParams.push(from); }
      if (to) { leadsWhere.push('DATE(created_at) <= ?'); leadsParams.push(to); }
      const leadsClause = leadsWhere.length ? `WHERE ${leadsWhere.join(' AND ')}` : '';

      // Date filter lives in the LEFT JOIN's ON clause, not a WHERE, so sites
      // with zero expenses in range still appear (with all-zero totals).
      const ledgerWhere: string[] = [];
      const ledgerParams: any[] = [];
      if (from) { ledgerWhere.push('l.date >= ?'); ledgerParams.push(from); }
      if (to) { ledgerWhere.push('l.date <= ?'); ledgerParams.push(to); }
      const ledgerClause = ledgerWhere.length ? ` AND ${ledgerWhere.join(' AND ')}` : '';

      const leadsMetrics = await db.query(
        `SELECT
          COUNT(*) as total_leads,
          COUNT(IF(status = 'Converted Client', 1, NULL)) as converted_leads,
          source
        FROM leads ${leadsClause} GROUP BY source`,
        leadsParams
      );

      const expenseMatrix = await db.query(
        `SELECT
          s.id,
          s.name as site_name,
          COALESCE(SUM(IF(l.category NOT IN ('Fuel', 'Petty Cash'), l.amount, 0)), 0) as material_costs,
          COALESCE(SUM(IF(l.category = 'Fuel', l.amount, 0)), 0) as fuel_costs,
          COALESCE(SUM(IF(l.category = 'Petty Cash', l.amount, 0)), 0) as petty_cash_costs,
          COALESCE(SUM(IF(l.payment_mode = 'Direct', l.amount, 0)), 0) as direct_expenses,
          COALESCE(SUM(IF(l.payment_mode = 'Indirect', l.amount, 0)), 0) as indirect_expenses,
          COALESCE(SUM(l.amount), 0) as total_expenses
        FROM sites s
        LEFT JOIN ledger l ON s.id = l.site_id AND l.type = 'DEBIT'${ledgerClause}
        GROUP BY s.id, s.name`,
        ledgerParams
      );

      res.status(200).json({
        leadsChannelPerformance: leadsMetrics.rows,
        siteWiseExpenseBreakdown: expenseMatrix.rows
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // All submitted Daily Sheets across every site, newest first — used by the
  // Admin panel to review supervisor-wise daily reports. Optional ?date=, ?from=, ?to= filters.
  getAllDailySheets: async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, from, to } = req.query;
      let queryText = `
        SELECT ds.*, s.name as site_name, u.name as supervisor_name
        FROM daily_sheets ds
        JOIN sites s ON ds.site_id = s.id
        JOIN users u ON ds.user_id = u.id
      `;
      const params: any[] = [];
      const conditions: string[] = [];

      if (date) {
        conditions.push('ds.date = ?');
        params.push(date);
      } else {
        if (from) {
          conditions.push('ds.date >= ?');
          params.push(from);
        }
        if (to) {
          conditions.push('ds.date <= ?');
          params.push(to);
        }
      }

      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      queryText += ' ORDER BY ds.date DESC, u.name ASC, ds.id DESC';
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
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
