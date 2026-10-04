import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { RequireRole } from './components/RequireRole';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { RequestHelpPage } from './pages/RequestHelpPage';
import { SosPage } from './pages/SosPage';

/*
 * The emergency path (Home → SOS → Request help) is in the main bundle so it
 * is instantly available. Everything else is code-split; the service worker
 * precaches every chunk, so lazy routes still open offline.
 */
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const SheltersPage = lazy(() => import('./pages/SheltersPage'));
const ShelterDetailPage = lazy(() => import('./pages/ShelterDetailPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const GuidesPage = lazy(() => import('./pages/GuidesPage'));
const GuideDetailPage = lazy(() => import('./pages/GuideDetailPage'));
const SafetyStatusPage = lazy(() => import('./pages/SafetyStatusPage'));
const FamilyPage = lazy(() => import('./pages/FamilyPage'));
const OfflineDataPage = lazy(() => import('./pages/OfflineDataPage'));
const ShareLocationPage = lazy(() => import('./pages/ShareLocationPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VolunteerPage = lazy(() => import('./pages/staff/VolunteerPage'));
const ResponderDashboard = lazy(() => import('./pages/staff/ResponderDashboard'));
const IncidentDetailPage = lazy(() => import('./pages/staff/IncidentDetailPage'));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminManagePage = lazy(() => import('./pages/admin/AdminManagePage'));
const DemoPage = lazy(() => import('./pages/admin/DemoPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sos', element: <SosPage /> },
      { path: 'help', element: <RequestHelpPage /> },
      { path: 'reports', element: <MyReportsPage /> },
      { path: 'reports/:clientId', element: <ReportDetailPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'shelters', element: <SheltersPage /> },
      { path: 'shelters/:id', element: <ShelterDetailPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'guides', element: <GuidesPage /> },
      { path: 'guides/:slug', element: <GuideDetailPage /> },
      { path: 'status', element: <SafetyStatusPage /> },
      { path: 'family', element: <FamilyPage /> },
      { path: 'offline', element: <OfflineDataPage /> },
      { path: 'share-location', element: <ShareLocationPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        element: <RequireRole roles={['VOLUNTEER']} />,
        children: [{ path: 'volunteer', element: <VolunteerPage /> }],
      },
      {
        element: <RequireRole roles={['VOLUNTEER', 'RESPONDER', 'ADMIN']} />,
        children: [{ path: 'incidents/:id', element: <IncidentDetailPage /> }],
      },
      {
        element: <RequireRole roles={['RESPONDER', 'ADMIN']} />,
        children: [{ path: 'responder', element: <ResponderDashboard /> }],
      },
      {
        element: <RequireRole roles={['ADMIN']} />,
        children: [
          { path: 'admin', element: <AdminOverviewPage /> },
          { path: 'admin/manage', element: <AdminManagePage /> },
          { path: 'admin/demo', element: <DemoPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
