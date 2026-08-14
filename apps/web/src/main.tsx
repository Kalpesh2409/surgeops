import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ManageUsers from './pages/ManageUsers'
import SalesAnalytics from './pages/SalesAnalytics'
import About from './pages/About'
import Home from './pages/Home'
import ProtectedRoute from './components/ProtectedRoute'
import { TooltipProvider } from '@/components/ui/tooltip'

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/operations" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-users"
          element={
            <ProtectedRoute>
              <ManageUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-analytics"
          element={
            <ProtectedRoute>
              <SalesAnalytics />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
)