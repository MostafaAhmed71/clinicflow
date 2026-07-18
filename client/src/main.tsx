import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './i18n'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { FocusModeProvider } from './hooks/useFocusMode.tsx'
import { PermissionsProvider } from './hooks/usePermissions.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PermissionsProvider>
          <FocusModeProvider>
            <App />
          </FocusModeProvider>
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
