import { configure } from '@helix/api-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app.tsx'
import { env } from './env'

configure({ baseUrl: env.VITE_API_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
