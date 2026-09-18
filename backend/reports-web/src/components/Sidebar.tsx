import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { clearSession, getSession } from '../auth';

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/daybook', label: 'Day Book' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/period-report', label: 'Monthly / Yearly Report' },
  { to: '/io-report', label: 'Role I/O Statement' },
  { to: '/sites', label: 'Site Expense Reports' },
  { to: '/indirect-bills', label: 'Indirect Bills' },
  { to: '/drivers', label: 'Driver Reports' },
  { to: '/attendance', label: 'Attendance Reports' },
  { to: '/daily-sheet', label: 'Daily Sheet Reports' },
  { to: '/leads', label: 'Leads Report' },
  { to: '/directory', label: 'Staff & Sites Directory' },
];

type SidebarProps = {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
};

export default function Sidebar({ isOpen, isCollapsed, onNavigate, onToggleCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const session = getSession();

  const handleLogout = () => {
    clearSession();
    if (onNavigate) onNavigate();
    navigate('/login');
  };

  const handleClose = () => {
    if (onNavigate) onNavigate();
    if (onToggleCollapse) onToggleCollapse();
  };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}${isCollapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-badge">AC</div>
        <div className="sidebar-brand-info">
          <div className="sidebar-brand-title">Ayyanar Reports</div>
          <div className="sidebar-brand-subtitle">Admin analytics</div>
        </div>
        <button className="sidebar-close-btn" onClick={handleClose} aria-label="Close sidebar" title="Close sidebar">
          <ChevronLeft size={18} className="desktop-only-icon" />
          <X size={18} className="mobile-only-icon" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {session && <div className="sidebar-brand-subtitle" style={{ padding: '0 10px 8px' }}>{session.name}</div>}
        <button className="logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}


