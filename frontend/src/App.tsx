import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import { AppLayout } from './components/AppLayout';
import { homePathFor } from './lib/labels';
import { CatalogPage } from './pages/CatalogPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { LoginPage } from './pages/LoginPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { NewTicketPage } from './pages/NewTicketPage';
import { PriorityRulesPage } from './pages/PriorityRulesPage';
import { ReportsPage } from './pages/ReportsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketQueuePage } from './pages/TicketQueuePage';
import { UserFormPage } from './pages/UserFormPage';
import { UsersPage } from './pages/UsersPage';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireRole />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<AppLayout />}>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route element={<RequireRole roles={['EMPLOYEE']} />}>
            <Route path="/new-ticket" element={<NewTicketPage />} />
            <Route path="/my-tickets" element={<MyTicketsPage />} />
          </Route>
          <Route element={<RequireRole roles={['TECHNICIAN', 'ADMIN']} />}>
            <Route path="/queue" element={<TicketQueuePage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
          </Route>
          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/new" element={<UserFormPage />} />
            <Route path="/users/:id/edit" element={<UserFormPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/priority-rules" element={<PriorityRulesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
