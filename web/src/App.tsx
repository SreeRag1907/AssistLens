import { Navigate, Route, Routes } from 'react-router-dom';
import { getAgentToken } from './lib/api';
import { Login } from './pages/Login';
import { AgentDashboard } from './pages/AgentDashboard';
import { AgentCall } from './pages/AgentCall';
import { SessionDetail } from './pages/SessionDetail';
import { CustomerJoin } from './pages/CustomerJoin';

function RequireAgent({ children }: { children: JSX.Element }) {
  return getAgentToken() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={getAgentToken() ? <Navigate to="/agent" replace /> : <Login />} />
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
      <Route path="/join" element={<CustomerJoin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
