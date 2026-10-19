import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext.jsx';

// Shows the page only to logged-in users with one of the allowed roles.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
