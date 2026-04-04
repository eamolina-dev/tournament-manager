import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TenantAuthProvider } from './shared/context/TenantAuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantAuthProvider>
      <App />
    </TenantAuthProvider>
  </StrictMode>,
)
