import { Router } from 'express';
import { fieldController } from '../controllers/fieldController';
import { adminController } from '../controllers/adminController';
import { authController } from '../controllers/authController';
import { accountsController } from '../controllers/accountsController';

const router = Router();

// Auth Routes
router.post('/login', authController.login);

// Field Supervisor & Driver Routes
router.post('/expenses', fieldController.logExpense);
router.get('/expenses/site/:siteId', fieldController.getLedgerBySite);
router.get('/wallet/:userId', fieldController.getSupervisorWallet);
router.get('/supervisor-sites/:userId', fieldController.getSupervisorSites);
router.post('/attendance', fieldController.submitAttendance);
router.post('/supervisor-attendance', fieldController.submitSupervisorAttendance);
router.post('/site-photos', fieldController.uploadSitePhoto);
router.get('/site-photos/recent', fieldController.getRecentSitePhotos);
router.post('/driver-records', fieldController.saveDriverRecord);
router.get('/driver-records', fieldController.getDriverRecords);

// Role Accounts (Admin / Supervisor / Owner money in-out ledgers + TotalAccounts overview)
router.post('/accounts/transactions', accountsController.addTransaction);
router.get('/accounts/total-summary', accountsController.getTotalSummary);
router.get('/accounts/daybook', accountsController.getDayBook);
router.get('/accounts/ledger', accountsController.getLedger);
router.get('/accounts/periods', accountsController.getPeriods);
router.get('/accounts/report', accountsController.getReport);
router.get('/accounts/io-report', accountsController.getIOReport);
router.get('/accounts/summary/:role', accountsController.getSummary);
router.get('/accounts/transactions/:role', accountsController.getTransactions);

// Administration & Management Panel Routes
router.post('/staff', adminController.addStaff);
router.get('/staff', adminController.getStaff);
router.delete('/staff/:id', adminController.deleteStaff);
router.get('/attendance/overview', adminController.getAttendanceOverview);
router.get('/sites', adminController.getSites);
router.post('/sites', adminController.createSite);
router.delete('/sites/:id', adminController.deleteSite);
router.post('/allocations', adminController.allocateSite);
router.get('/leads', adminController.getLeads);
router.post('/leads', adminController.createLead);
router.put('/leads/:id/status', adminController.updateLeadStatus);
router.get('/analytics/dashboard', adminController.getAnalyticsOverview);

export default router;
