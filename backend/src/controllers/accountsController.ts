import { Request, Response } from 'express';
import { db } from '../db';

// Money moved between our own roles (Owner -> Admin -> Supervisors) is an internal
// transfer, not company revenue or expense. Only external money counts for totals.
// Includes 'Supervisor' since mirrored entries use singular role names as category.
const INTERNAL_PARTIES = ['Owner', 'Admin', 'Supervisors', 'Supervisor'];
const internalList = INTERNAL_PARTIES.map(() => '?').join(', ');

// A transfer creates two rows (sender OUT + mirrored receiver IN). Books views show
// each transfer once, so mirrored INs (IN from an internal party) are filtered out.
const singleEntryFilter = `NOT (flow = 'IN' AND category IN (${internalList}))`;

// When an OUT entry targets one of our own roles, the receiving role's ledger gets
// a mirrored IN entry automatically (e.g. Admin pays 'Supervisors' 500 -> Supervisor
// gets an IN of 500 from 'Admin'). Maps OUT category -> receiving ledger role.
const TRANSFER_TARGETS: Record<string, 'Admin' | 'Supervisor' | 'Owner'> = {
  Admin: 'Admin',
  Supervisors: 'Supervisor',
  Owner: 'Owner',
};

export const accountsController = {
  // Records a money-in or money-out entry for a role ledger (Admin / Supervisor / Owner)
  addTransaction: async (req: Request, res: Response): Promise<void> => {
    try {
      const { role, userId, flow, category, description, amount, date, partyName, recipientUserId, paymentMethod } = req.body;

      if (!role || !flow || !category || amount === undefined || amount === null || amount === '') {
        res.status(400).json({ success: false, error: 'role, flow, category and amount are required.' });
        return;
      }
      if (!['Admin', 'Supervisor', 'Owner'].includes(role) || !['IN', 'OUT'].includes(flow)) {
        res.status(400).json({ success: false, error: 'Invalid role or flow.' });
        return;
      }
      // Only the Owner enters money-in by hand. Admin/Supervisor inputs are created
      // automatically below when another role sends them money.
      if (flow === 'IN' && role !== 'Owner') {
        res.status(403).json({
          success: false,
          error: 'Only the Owner can enter money-in directly. Other inputs are logged automatically from transfers.',
        });
        return;
      }
      const cleanAmount = parseFloat(amount.toString());
      if (isNaN(cleanAmount) || cleanAmount <= 0) {
        res.status(400).json({ success: false, error: 'amount must be a positive number.' });
        return;
      }

      const cleanDate = date || new Date().toISOString().split('T')[0];
      const cleanPartyName = partyName || null;
      const cleanMethod = paymentMethod === 'Bank' ? 'Bank' : 'Cash';

      await db.query(
        `INSERT INTO account_transactions (role, user_id, flow, category, party_name, payment_method, description, amount, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          role,
          userId ? parseInt(userId.toString()) : null,
          flow,
          category,
          cleanPartyName,
          cleanMethod,
          description || null,
          cleanAmount,
          cleanDate,
        ]
      );

      // Mirror internal transfers into the receiving role's ledger as an IN entry.
      // When a specific supervisor was chosen, the mirrored entry carries their
      // user_id and name so the receipt is attributed to that real person.
      const recipientRole = flow === 'OUT' ? TRANSFER_TARGETS[category] : undefined;
      if (recipientRole && recipientRole !== role) {
        await db.query(
          `INSERT INTO account_transactions (role, user_id, flow, category, party_name, payment_method, description, amount, date)
           VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)`,
          [
            recipientRole,
            recipientUserId ? parseInt(recipientUserId.toString()) : null,
            role,
            cleanPartyName,
            cleanMethod,
            description || `Transfer from ${role}`,
            cleanAmount,
            cleanDate,
          ]
        );
        res.status(201).json({
          success: true,
          message: `Payment recorded and credited to ${cleanPartyName || recipientRole} (${recipientRole} account).`,
        });
        return;
      }

      res.status(201).json({ success: true, message: 'Transaction recorded.' });
    } catch (error: any) {
      console.error('addTransaction Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lists transactions for a role, optionally filtered by flow (?flow=IN|OUT) and date range (?from&to)
  getTransactions: async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.params;
      const { flow, from, to } = req.query;

      let sql = 'SELECT * FROM account_transactions WHERE role = ?';
      const params: any[] = [role];
      if (req.query.userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(req.query.userId.toString()));
      }
      if (flow === 'IN' || flow === 'OUT') {
        sql += ' AND flow = ?';
        params.push(flow);
      }
      if (from) {
        sql += ' AND date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND date <= ?';
        params.push(to);
      }
      sql += ' ORDER BY date DESC, id DESC';

      const result = await db.query(sql, params);
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getTransactions Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Date-wise statement for one role: Date | Input | Output | running Balance.
  // Optional ?from&to range; the opening balance carries everything before `from`.
  getIOReport: async (req: Request, res: Response): Promise<void> => {
    try {
      const { role, from, to } = req.query;
      if (!role || !['Admin', 'Supervisor', 'Owner'].includes(role.toString())) {
        res.status(400).json({ success: false, error: 'Provide role=Admin|Supervisor|Owner.' });
        return;
      }

      let opening = 0;
      if (from) {
        let openingSql = `SELECT COALESCE(SUM(IF(flow = 'IN', amount, -amount)), 0) AS opening
           FROM account_transactions WHERE role = ?`;
        const openingParams: any[] = [role];
        if (req.query.userId) {
          openingSql += ' AND user_id = ?';
          openingParams.push(parseInt(req.query.userId.toString()));
        }
        openingSql += ' AND date < ?';
        openingParams.push(from);

        const openingResult = await db.query(openingSql, openingParams);
        opening = Number(openingResult.rows[0].opening);
      }

      let sql = `
        SELECT date,
          COALESCE(SUM(IF(flow = 'IN', amount, 0)), 0) AS input,
          COALESCE(SUM(IF(flow = 'OUT', amount, 0)), 0) AS output
        FROM account_transactions WHERE role = ?`;
      const params: any[] = [role];
      if (req.query.userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(req.query.userId.toString()));
      }
      if (from) {
        sql += ' AND date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND date <= ?';
        params.push(to);
      }
      sql += ' GROUP BY date ORDER BY date ASC';

      const result = await db.query(sql, params);

      let balance = opening;
      const rows = (result.rows || []).map((r: any) => {
        balance += Number(r.input) - Number(r.output);
        return {
          date: r.date,
          input: Number(r.input),
          output: Number(r.output),
          balance,
        };
      });

      res.status(200).json({
        role,
        opening,
        rows,
        totals: {
          input: rows.reduce((s: number, r: any) => s + r.input, 0),
          output: rows.reduce((s: number, r: any) => s + r.output, 0),
          closing: balance,
        },
      });
    } catch (error: any) {
      console.error('getIOReport Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Simple dashboard numbers for one role: totals, balance, per-category breakdown, recent entries
  getSummary: async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.params;

      let totalsSql = `SELECT
           COALESCE(SUM(IF(flow = 'IN', amount, 0)), 0) AS totalIn,
           COALESCE(SUM(IF(flow = 'OUT', amount, 0)), 0) AS totalOut
         FROM account_transactions WHERE role = ?`;
      const totalsParams: any[] = [role];

      let breakdownSql = `SELECT flow, category, party_name, COALESCE(SUM(amount), 0) AS total
         FROM account_transactions WHERE role = ?`;
      const breakdownParams: any[] = [role];

      let recentSql = 'SELECT * FROM account_transactions WHERE role = ?';
      const recentParams: any[] = [role];

      if (req.query.userId) {
        const uId = parseInt(req.query.userId.toString());
        totalsSql += ' AND user_id = ?';
        totalsParams.push(uId);
        breakdownSql += ' AND user_id = ?';
        breakdownParams.push(uId);
        recentSql += ' AND user_id = ?';
        recentParams.push(uId);
      }

      breakdownSql += ' GROUP BY flow, category, party_name ORDER BY flow, total DESC';
      recentSql += ' ORDER BY date DESC, id DESC LIMIT 10';

      const totalsResult = await db.query(totalsSql, totalsParams);
      const breakdownResult = await db.query(breakdownSql, breakdownParams);
      const recentResult = await db.query(recentSql, recentParams);

      const { totalIn, totalOut } = totalsResult.rows[0];
      res.status(200).json({
        totalIn: Number(totalIn),
        totalOut: Number(totalOut),
        balance: Number(totalIn) - Number(totalOut),
        inBreakdown: breakdownResult.rows.filter((r: any) => r.flow === 'IN'),
        outBreakdown: breakdownResult.rows.filter((r: any) => r.flow === 'OUT'),
        recent: recentResult.rows,
      });
    } catch (error: any) {
      console.error('getSummary Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Chronological book of all transactions across every role, one row per transfer.
  // Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD range filter.
  getDayBook: async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query;
      let sql = `SELECT * FROM account_transactions WHERE ${singleEntryFilter}`;
      const params: any[] = [...INTERNAL_PARTIES];

      if (from && to) {
        sql += ' AND date >= ? AND date <= ?';
        params.push(from, to);
      } else if (from) {
        sql += ' AND date = ?';
        params.push(from);
      } else if (to) {
        sql += ' AND date = ?';
        params.push(to);
      }
      sql += ' ORDER BY date DESC, id DESC';

      const result = await db.query(sql, params);
      res.status(200).json(result.rows || []);
    } catch (error: any) {
      console.error('getDayBook Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getLedger: async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query;
      let sql = `SELECT category, party_name,
           COALESCE(SUM(IF(flow = 'IN', amount, 0)), 0) AS receivedFrom,
           COALESCE(SUM(IF(flow = 'OUT', amount, 0)), 0) AS paidTo,
           COUNT(*) AS entries,
           MAX(date) AS lastDate
         FROM account_transactions
         WHERE ${singleEntryFilter}`;
      
      const params: any[] = [...INTERNAL_PARTIES];
      if (from && to) {
        sql += ' AND date >= ? AND date <= ?';
        params.push(from, to);
      } else if (from) {
        sql += ' AND date = ?';
        params.push(from);
      } else if (to) {
        sql += ' AND date = ?';
        params.push(to);
      }
      sql += ' GROUP BY category, party_name ORDER BY SUM(amount) DESC';

      const result = await db.query(sql, params);

      res.status(200).json(
        (result.rows || []).map((r: any) => ({
          party: r.party_name || r.category,
          category: r.category,
          receivedFrom: Number(r.receivedFrom),
          paidTo: Number(r.paidTo),
          net: Number(r.receivedFrom) - Number(r.paidTo),
          entries: Number(r.entries),
          lastDate: r.lastDate,
        }))
      );
    } catch (error: any) {
      console.error('getLedger Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Months and years that have transactions — used to build the report period pickers
  getPeriods: async (req: Request, res: Response): Promise<void> => {
    try {
      const monthsResult = await db.query(
        "SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') AS period FROM account_transactions ORDER BY period DESC"
      );
      const yearsResult = await db.query(
        'SELECT DISTINCT YEAR(date) AS period FROM account_transactions ORDER BY period DESC'
      );
      res.status(200).json({
        months: monthsResult.rows.map((r: any) => r.period.toString()),
        years: yearsResult.rows.map((r: any) => r.period.toString()),
      });
    } catch (error: any) {
      console.error('getPeriods Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Full report for one month (?type=monthly&period=2026-07) or year (?type=yearly&period=2026)
  getReport: async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, period } = req.query;

      if ((type !== 'monthly' && type !== 'yearly') || !period || !/^\d{4}(-\d{2})?$/.test(period.toString())) {
        res.status(400).json({ success: false, error: 'Provide type=monthly|yearly and a valid period (YYYY-MM or YYYY).' });
        return;
      }
      // Whitelisted expression — never built from user input
      const periodExpr = type === 'yearly' ? 'YEAR(date)' : "DATE_FORMAT(date, '%Y-%m') COLLATE utf8mb4_general_ci";
      const p = period.toString();

      const totalsResult = await db.query(
        `SELECT
           COALESCE(SUM(IF(flow = 'IN'  AND category NOT IN (${internalList}), amount, 0)), 0) AS revenue,
           COALESCE(SUM(IF(flow = 'OUT' AND category NOT IN (${internalList}), amount, 0)), 0) AS expenses,
           COALESCE(SUM(IF(flow = 'OUT' AND category IN (${internalList}), amount, 0)), 0) AS transfers
         FROM account_transactions WHERE ${periodExpr} = ?`,
        [...INTERNAL_PARTIES, ...INTERNAL_PARTIES, ...INTERNAL_PARTIES, p]
      );

      const receivedResult = await db.query(
        `SELECT category, COALESCE(SUM(amount), 0) AS total
         FROM account_transactions
         WHERE ${periodExpr} = ? AND flow = 'IN' AND category NOT IN (${internalList})
         GROUP BY category ORDER BY total DESC`,
        [p, ...INTERNAL_PARTIES]
      );

      const paidResult = await db.query(
        `SELECT category, party_name, COALESCE(SUM(amount), 0) AS total
         FROM account_transactions
         WHERE ${periodExpr} = ? AND flow = 'OUT'
         GROUP BY category, party_name ORDER BY total DESC`,
        [p]
      );

      const transactionsResult = await db.query(
        `SELECT * FROM account_transactions
         WHERE ${periodExpr} = ? AND ${singleEntryFilter}
         ORDER BY date ASC, id ASC`,
        [p, ...INTERNAL_PARTIES]
      );

      const { revenue, expenses, transfers } = totalsResult.rows[0];
      res.status(200).json({
        type,
        period: p,
        revenue: Number(revenue),
        expenses: Number(expenses),
        transfers: Number(transfers),
        profit: Number(revenue) - Number(expenses),
        receivedBreakdown: receivedResult.rows.map((r: any) => ({ category: r.category, total: Number(r.total) })),
        paidBreakdown: paidResult.rows.map((r: any) => ({
          category: r.party_name ? `${r.party_name} (${r.category})` : r.category,
          total: Number(r.total),
        })),
        transactions: transactionsResult.rows,
      });
    } catch (error: any) {
      console.error('getReport Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Company-wide view for the TotalAccounts login: revenue, expenses, profit,
  // monthly + yearly breakdown, and cash balance per role
  getTotalSummary: async (req: Request, res: Response): Promise<void> => {
    try {
      const totalsResult = await db.query(
        `SELECT
           COALESCE(SUM(IF(flow = 'IN'  AND category NOT IN (${internalList}), amount, 0)), 0) AS revenue,
           COALESCE(SUM(IF(flow = 'OUT' AND category NOT IN (${internalList}), amount, 0)), 0) AS expenses
         FROM account_transactions`,
        [...INTERNAL_PARTIES, ...INTERNAL_PARTIES]
      );

      const monthlyResult = await db.query(
        `SELECT
           DATE_FORMAT(date, '%Y-%m') AS period,
           COALESCE(SUM(IF(flow = 'IN'  AND category NOT IN (${internalList}), amount, 0)), 0) AS revenue,
           COALESCE(SUM(IF(flow = 'OUT' AND category NOT IN (${internalList}), amount, 0)), 0) AS expenses
         FROM account_transactions
         GROUP BY period ORDER BY period DESC LIMIT 12`,
        [...INTERNAL_PARTIES, ...INTERNAL_PARTIES]
      );

      const yearlyResult = await db.query(
        `SELECT
           YEAR(date) AS period,
           COALESCE(SUM(IF(flow = 'IN'  AND category NOT IN (${internalList}), amount, 0)), 0) AS revenue,
           COALESCE(SUM(IF(flow = 'OUT' AND category NOT IN (${internalList}), amount, 0)), 0) AS expenses
         FROM account_transactions
         GROUP BY period ORDER BY period DESC`,
        [...INTERNAL_PARTIES, ...INTERNAL_PARTIES]
      );

      const roleBalancesResult = await db.query(
        `SELECT role,
           COALESCE(SUM(IF(flow = 'IN', amount, 0)), 0) AS totalIn,
           COALESCE(SUM(IF(flow = 'OUT', amount, 0)), 0) AS totalOut
         FROM account_transactions GROUP BY role`
      );

      const { revenue, expenses } = totalsResult.rows[0];
      const withProfit = (rows: any[]) =>
        rows.map((r: any) => ({
          period: r.period.toString(),
          revenue: Number(r.revenue),
          expenses: Number(r.expenses),
          profit: Number(r.revenue) - Number(r.expenses),
        }));

      res.status(200).json({
        revenue: Number(revenue),
        expenses: Number(expenses),
        profit: Number(revenue) - Number(expenses),
        monthly: withProfit(monthlyResult.rows),
        yearly: withProfit(yearlyResult.rows),
        roleBalances: roleBalancesResult.rows.map((r: any) => ({
          role: r.role,
          totalIn: Number(r.totalIn),
          totalOut: Number(r.totalOut),
          balance: Number(r.totalIn) - Number(r.totalOut),
        })),
      });
    } catch (error: any) {
      console.error('getTotalSummary Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
