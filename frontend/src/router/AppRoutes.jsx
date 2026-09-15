import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import AdminDashboard from "../pages/AdminDashnoard";
import BookAppointment from "../pages/BookAppointment";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={ <MainLayout> <AdminDashboard/> </MainLayout> } />
      <Route path="/appointments/book" element={ <MainLayout> <BookAppointment/> </MainLayout>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoutes;
