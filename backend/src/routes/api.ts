import { Router } from 'express';
import { fieldController } from '../controllers/fieldController';
import { adminController } from '../controllers/adminController';
import { authController } from '../controllers/authController';

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
router.post('/fuel', fieldController.logFuel);
router.post('/trips', fieldController.logTrip);
router.post('/advance-request', fieldController.requestAdvance);
router.post('/advance-request/pay', fieldController.payAdvance);

// Administration & Management Panel Routes
router.post('/staff', adminController.addStaff);
router.get('/staff', adminController.getStaff);
router.delete('/staff/:id', adminController.deleteStaff);
router.get('/advance-requests', adminController.getAdvanceRequests);
router.put('/advance-requests/:id/status', adminController.updateAdvanceStatus);
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
