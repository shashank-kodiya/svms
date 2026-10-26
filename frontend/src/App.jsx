import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CustomerDashboard from './pages/customer/CustomerDashboard.jsx';
import VehicleList from './pages/customer/VehicleList.jsx';
import VehicleForm from './pages/customer/VehicleForm.jsx';
import VehicleDetail from './pages/customer/VehicleDetail.jsx';
import BookService from './pages/customer/BookService.jsx';
import FindCenters from './pages/customer/FindCenters.jsx';
import CenterDetails from './pages/customer/CenterDetails.jsx';
import MyBookings from './pages/customer/MyBookings.jsx';
import BookingDetail from './pages/customer/BookingDetail.jsx';
import CenterJobs from './pages/center/CenterJobs.jsx';
import JobCard from './pages/center/JobCard.jsx';
import CenterBookings from './pages/center/CenterBookings.jsx';
import AdminBookings from './pages/admin/AdminBookings.jsx';
import CenterDashboard from './pages/center/CenterDashboard.jsx';
import CenterProfile from './pages/center/CenterProfile.jsx';
import CenterServices from './pages/center/CenterServices.jsx';
import CenterHours from './pages/center/CenterHours.jsx';
import CenterMechanics from './pages/center/CenterMechanics.jsx';
import CenterParts from './pages/center/CenterParts.jsx';
import CenterPayments from './pages/center/CenterPayments.jsx';
import CenterRevenue from './pages/center/CenterRevenue.jsx';
import CenterFeedback from './pages/center/CenterFeedback.jsx';
import AdminComplaints from './pages/admin/AdminComplaints.jsx';
import VerifyInvoice from './pages/VerifyInvoice.jsx';
import Notifications from './pages/Notifications.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import { useAuth, homeFor } from './context/AuthContext.jsx';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading…</div>;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

function CustomerArea() {
  return (
    <Routes>
      <Route index element={<CustomerDashboard />} />
      <Route path="vehicles" element={<VehicleList />} />
      <Route path="vehicles/new" element={<VehicleForm />} />
      <Route path="vehicles/:id" element={<VehicleDetail />} />
      <Route path="vehicles/:id/edit" element={<VehicleForm />} />
      <Route path="nearby" element={<FindCenters />} />
      <Route path="centers/:id" element={<CenterDetails />} />
      <Route path="book" element={<BookService />} />
      <Route path="bookings" element={<MyBookings />} />
      <Route path="bookings/:id" element={<BookingDetail />} />
      <Route path="*" element={<Navigate to="/customer" replace />} />
    </Routes>
  );
}

function CenterArea() {
  return (
    <Routes>
      <Route index element={<CenterDashboard />} />
      <Route path="bookings" element={<CenterBookings />} />
      <Route path="jobs" element={<CenterJobs />} />
      <Route path="jobs/:id" element={<JobCard />} />
      <Route path="profile" element={<CenterProfile />} />
      <Route path="services" element={<CenterServices />} />
      <Route path="hours" element={<CenterHours />} />
      <Route path="mechanics" element={<CenterMechanics />} />
      <Route path="parts" element={<CenterParts />} />
      <Route path="payments" element={<CenterPayments />} />
      <Route path="revenue" element={<CenterRevenue />} />
      <Route path="feedback" element={<CenterFeedback />} />
      <Route path="*" element={<Navigate to="/center" replace />} />
    </Routes>
  );
}

function AdminArea() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="bookings" element={<AdminBookings />} />
      <Route path="complaints" element={<AdminComplaints />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:id" element={<VerifyInvoice />} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/customer/*" element={<ProtectedRoute roles={['customer']}><CustomerArea /></ProtectedRoute>} />
      <Route path="/center/*" element={<ProtectedRoute roles={['service_center']}><CenterArea /></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute roles={['admin']}><AdminArea /></ProtectedRoute>} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
