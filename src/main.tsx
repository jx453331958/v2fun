import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ListCacheProvider } from './hooks/useListCache'
import { ThemeProvider } from './hooks/useTheme'
import PasscodeGate from './components/PasscodeGate'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PasscodeGate>
        <BrowserRouter>
          <ListCacheProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ListCacheProvider>
        </BrowserRouter>
      </PasscodeGate>
    </ThemeProvider>
  </StrictMode>,
)
