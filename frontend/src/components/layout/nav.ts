import type { Role } from '@resqnet/shared';
import {
  Bell,
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  HeartHandshake,
  Home,
  House,
  LayoutDashboard,
  Phone,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Navigation configuration shared by the sidebar, bottom bar and More page. */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  end?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/shelters', label: 'Shelters', icon: House },
  { to: '/contacts', label: 'Emergency contacts', icon: Phone },
  { to: '/guides', label: 'Safety guides', icon: BookOpen },
  { to: '/reports', label: 'My reports', icon: FileText },
  { to: '/status', label: 'My safety status', icon: ShieldCheck },
  { to: '/family', label: 'Family & group', icon: Users },
  { to: '/offline', label: 'Offline data', icon: Database },
];

export const STAFF_NAV: NavItem[] = [
  { to: '/volunteer', label: 'Volunteer tasks', icon: HeartHandshake, roles: ['VOLUNTEER'] },
  { to: '/responder', label: 'Responder dashboard', icon: ClipboardList, roles: ['RESPONDER', 'ADMIN'] },
  { to: '/admin', label: 'Admin overview', icon: LayoutDashboard, roles: ['ADMIN'], end: true },
  { to: '/admin/manage', label: 'Manage data', icon: Gauge, roles: ['ADMIN'] },
  { to: '/admin/demo', label: 'Simulation mode', icon: FlaskConical, roles: ['ADMIN'] },
];

