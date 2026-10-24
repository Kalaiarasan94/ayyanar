import { Request, Response } from 'express';
import { db } from '../db';

export const authController = {
  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;
      const result = await db.query(
        'SELECT id, username, name, role, phone, mpin, biometric_enabled FROM users WHERE username = ? AND password = ?',
        [username, password]
      );
      
      if (result.rows.length > 0) {
        const u = result.rows[0];
        res.status(200).json({
          success: true,
          user: {
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            phone: u.phone,
            hasMpin: !!u.mpin,
            biometricEnabled: !!u.biometric_enabled,
          },
        });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Login using 4-digit MPIN
  loginWithMpin: async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, userId, mpin } = req.body;
      const cleanMpin = mpin ? mpin.toString().trim() : '';

      if (!cleanMpin) {
        res.status(400).json({ success: false, message: 'MPIN is required.' });
        return;
      }

      let sql = '';
      let params: any[] = [];

      if (userId) {
        sql = 'SELECT id, username, name, role, phone, mpin, biometric_enabled FROM users WHERE id = ?';
        params = [userId];
      } else if (username) {
        sql = 'SELECT id, username, name, role, phone, mpin, biometric_enabled FROM users WHERE username = ? OR phone = ?';
        params = [username.trim(), username.trim()];
      } else {
        res.status(400).json({ success: false, message: 'Username or User ID is required.' });
        return;
      }

      const result = await db.query(sql, params);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      const user = result.rows[0];
      if (!user.mpin) {
        res.status(400).json({
          success: false,
          message: 'MPIN is not configured for this account. Please log in with password to set up your MPIN in profile.',
        });
        return;
      }

      if (user.mpin !== cleanMpin) {
        res.status(401).json({ success: false, message: 'Incorrect MPIN. Please try again.' });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          phone: user.phone,
          hasMpin: true,
          biometricEnabled: !!user.biometric_enabled,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Complete login after client device biometric verification succeeds
  loginWithBiometric: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, username } = req.body;
      if (!userId && !username) {
        res.status(400).json({ success: false, message: 'User identifier required for biometric login.' });
        return;
      }

      const sql = userId
        ? 'SELECT id, username, name, role, phone, mpin, biometric_enabled FROM users WHERE id = ?'
        : 'SELECT id, username, name, role, phone, mpin, biometric_enabled FROM users WHERE username = ? OR phone = ?';
      const params = [userId || username];

      const result = await db.query(sql, params);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      const user = result.rows[0];
      if (!user.biometric_enabled) {
        res.status(403).json({
          success: false,
          message: 'Biometric login is not enabled for this user. Please enable it in your profile first.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          phone: user.phone,
          hasMpin: !!user.mpin,
          biometricEnabled: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Set or update 4-digit MPIN
  setMpin: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, mpin } = req.body;
      if (!userId || !mpin) {
        res.status(400).json({ success: false, message: 'User ID and MPIN are required.' });
        return;
      }

      const cleanMpin = mpin.toString().trim();
      if (!/^\d{4,6}$/.test(cleanMpin)) {
        res.status(400).json({ success: false, message: 'MPIN must be 4 to 6 numeric digits.' });
        return;
      }

      await db.query('UPDATE users SET mpin = ? WHERE id = ?', [cleanMpin, userId]);
      res.status(200).json({ success: true, message: 'MPIN configured successfully.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Remove MPIN
  removeMpin: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ success: false, message: 'User ID is required.' });
        return;
      }

      await db.query('UPDATE users SET mpin = NULL WHERE id = ?', [userId]);
      res.status(200).json({ success: true, message: 'MPIN disabled successfully.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Toggle biometric status
  setBiometric: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, enabled } = req.body;
      if (!userId) {
        res.status(400).json({ success: false, message: 'User ID is required.' });
        return;
      }

      await db.query('UPDATE users SET biometric_enabled = ? WHERE id = ?', [enabled ? 1 : 0, userId]);
      res.status(200).json({
        success: true,
        message: `Biometric login ${enabled ? 'enabled' : 'disabled'} successfully.`,
        biometricEnabled: !!enabled,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Fetch security settings for profile screen
  getSecurityStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const result = await db.query('SELECT mpin, biometric_enabled FROM users WHERE id = ?', [userId]);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        hasMpin: !!result.rows[0].mpin,
        biometricEnabled: !!result.rows[0].biometric_enabled,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
