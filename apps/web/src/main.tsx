import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ManageUsers from './pages/ManageUsers'
import ProtectedRoute from './components/ProtectedRoute'
import { TooltipProvider } from '@/components/ui/tooltip'
import Hero from './components/Hero'
import ProblemSolution from './components/ProblemSolution'
import HowPricingWorks from './components/HowPricingWorks'
import SeeSurgeOpsInAction from './components/SeeSurgeOpsInAction'
import TechStack from './components/TechStack'
import PublicHeader from './components/PublicHeader'
import Footer from './components/Footer'

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
        {/* TEMPORARY — remove once these are wired into the real Home page */}
        <Route
          path="/preview-3d"
          element={
            <>
              <PublicHeader />
              <Hero />
              <ProblemSolution />
              <HowPricingWorks />
              <SeeSurgeOpsInAction />
              <TechStack />
              <Footer />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
)