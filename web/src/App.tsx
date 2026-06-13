import { Navigate, Route, Routes } from 'react-router-dom';
import { getAdminToken, getAgentToken } from './lib/api';
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { AgentDashboard } from './pages/AgentDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminSessionDetail } from './pages/AdminSessionDetail';
import { AgentCall } from './pages/AgentCall';
import { SessionDetail } from './pages/SessionDetail';
import { CustomerJoin } from './pages/CustomerJoin';

function RequireAgent({ children }: { children: JSX.Element }) {
  return getAgentToken() ? children : <Navigate to="/" replace />;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  return getAdminToken() ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={getAgentToken() ? <Navigate to="/agent" replace /> : <Login />} />
      <Route path="/admin/login" element={getAdminToken() ? <Navigate to="/admin" replace /> : <AdminLogin />} />
      <Route
        path="/agent"
        element={
          <RequireAgent>
            <AgentDashboard />
          </RequireAgent>
        }
      />
      <Route
        path="/agent/call/:id"
        element={
          <RequireAgent>
            <AgentCall />
          </RequireAgent>
        }
      />
      <Route
        path="/agent/history/:id"
        element={
          <RequireAgent>
            <SessionDetail />
          </RequireAgent>
        }
      />
      <Route
        path="/admin/sessions/:id"
        element={
          <RequireAdmin>
            <AdminSessionDetail />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route path="/j/:code" element={<CustomerJoin />} />
      <Route path="/join" element={<CustomerJoin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
