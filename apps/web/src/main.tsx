import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ManageUsers from './pages/ManageUsers'
import ProtectedRoute from './components/ProtectedRoute'
import { TooltipProvider } from '@/components/ui/tooltip'
import Hero3D from './components/Hero3D'

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
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
        {/* TEMPORARY — remove once Hero3D is wired into the real Home page */}
        <Route
          path="/preview-3d"
          element={<div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}><Hero3D /></div>}
        />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
)