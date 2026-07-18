import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from './components/AppLayout'
import { RequirePermission } from './components/RequirePermission'
import { SecretaryLayout } from './components/SecretaryLayout'
import { useAuth } from './hooks/useAuth'
import { AdminPage } from './pages/AdminPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { CashRegisterPage } from './pages/CashRegisterPage'
import { ClinicSetupPage } from './pages/ClinicSetupPage'
import { ConsultationPage } from './pages/ConsultationPage'
import { DashboardPage } from './pages/DashboardPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { PatientImportPage } from './pages/PatientImportPage'
import { PatientsPage } from './pages/PatientsPage'
import { PermissionsPage } from './pages/PermissionsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SecretaryDeskPage } from './pages/SecretaryDeskPage'
import { SettingsPage } from './pages/SettingsPage'
import { SignupPage } from './pages/SignupPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { FollowUpsPage } from './pages/FollowUpsPage'
import { WaitingRoomPage } from './pages/WaitingRoomPage'

function AuthBootScreen() {
  const { t } = useTranslation()
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-md text-on-background">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="absolute right-[-10%] top-[-20%] h-[600px] w-[600px] rounded-full bg-primary-fixed blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-secondary-container blur-[100px]" />
      </div>
      <div className="fade-in-up relative z-10 flex max-w-lg flex-col items-center space-y-lg text-center">
        <div className="mb-lg">
          <div className="pulse-slow relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:h-40 md:w-40">
            <span
              className="material-symbols-outlined text-primary text-[64px] md:text-[80px]"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48" }}
            >
              medical_services
            </span>
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent" />
          </div>
        </div>
        <div className="space-y-sm">
          <h1 className="font-display text-display tracking-tight text-primary">{t('appName')}</h1>
          <p className="font-title-lg text-title-lg font-medium text-on-surface-variant">{t('splash.tagline')}</p>
        </div>
        <div className="cf-splash-bar mt-lg w-48" />
        <p className="font-body-md text-body-md text-outline">...{t('common.loading')}</p>
      </div>
      <p className="absolute bottom-6 z-10 text-xs text-outline">{t('splash.copyright')}</p>
    </main>
  )
}

function ProtectedClinic() {
  const { session, user, loading } = useAuth()

  // Only block the first boot — never blank the app on later navigations/token refresh
  if (loading && !user) return <AuthBootScreen />

  if (!session) return <Navigate to="/login" replace />

  if (user?.role === 'super_admin') {
    return <Navigate to="/admin" replace />
  }

  if (!user?.tenant_id) return <Navigate to="/onboarding" replace />

  // Secretaries use the dedicated desk UI
  if (user.role === 'secretary') {
    return <Navigate to="/desk" replace />
  }

  return (
    <RequirePermission>
      <Outlet />
    </RequirePermission>
  )
}

function ProtectedSecretary() {
  const { session, user, loading } = useAuth()

  if (loading && !user) return <AuthBootScreen />

  if (!session) return <Navigate to="/login" replace />
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (!user?.tenant_id) return <Navigate to="/onboarding" replace />

  // Desk is for secretary; doctors may also open it
  if (!['secretary', 'doctor', 'clinic_manager'].includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function ProtectedAdmin() {
  const { session, user, loading } = useAuth()

  if (loading && !user) return <AuthBootScreen />

  if (!session) return <Navigate to="/login" replace />
  if (user?.role !== 'super_admin') return <Navigate to="/" replace />

  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route element={<ProtectedAdmin />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>

      <Route element={<ProtectedSecretary />}>
        <Route element={<SecretaryLayout />}>
          <Route path="desk" element={<SecretaryDeskPage />} />
          <Route path="desk/waiting" element={<WaitingRoomPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedClinic />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/import" element={<PatientImportPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="waiting" element={<WaitingRoomPage />} />
          <Route path="follow-ups" element={<FollowUpsPage />} />
          <Route path="consultation" element={<ConsultationPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="cash" element={<CashRegisterPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/setup" element={<ClinicSetupPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
