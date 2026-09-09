import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { getSession } from './auth';
import Login from './pages/Login';
import Overview from './pages/Overview';
import DayBook from './pages/DayBook';
import Ledger from './pages/Ledger';
import PeriodReport from './pages/PeriodReport';
import IoReport from './pages/IoReport';
import SiteReports from './pages/SiteReports';
import DriverReports from './pages/DriverReports';
import AttendanceReport from './pages/AttendanceReport';
import LeadsReport from './pages/LeadsReport';
import DailySheetReport from './pages/DailySheetReport';
import Directory from './pages/Directory';

function RequireAuth({ children }: { children: ReactNode }) {
  const session = getSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Auto-close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
          <Menu size={22} />
        </button>
        <div className="mobile-topbar-brand">
          <span className="mobile-topbar-badge">AC</span>
          <span className="mobile-topbar-title">Ayyanar Reports</span>
        </div>
      </header>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Overview /></RequireAuth>} />
      <Route path="/daybook" element={<RequireAuth><DayBook /></RequireAuth>} />
      <Route path="/ledger" element={<RequireAuth><Ledger /></RequireAuth>} />
      <Route path="/period-report" element={<RequireAuth><PeriodReport /></RequireAuth>} />
      <Route path="/io-report" element={<RequireAuth><IoReport /></RequireAuth>} />
      <Route path="/sites" element={<RequireAuth><SiteReports /></RequireAuth>} />
      <Route path="/drivers" element={<RequireAuth><DriverReports /></RequireAuth>} />
      <Route path="/attendance" element={<RequireAuth><AttendanceReport /></RequireAuth>} />
      <Route path="/daily-sheet" element={<RequireAuth><DailySheetReport /></RequireAuth>} />
      <Route path="/leads" element={<RequireAuth><LeadsReport /></RequireAuth>} />
      <Route path="/directory" element={<RequireAuth><Directory /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

