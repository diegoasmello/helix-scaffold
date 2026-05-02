import { configure } from '@helix/api-client'
import {
  emotionTransform,
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
  Notifications,
} from '@helix/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app.tsx'
import { theme } from './config/theme'
import { env } from './env'
import { queryClient } from './lib/query-client.ts'

configure({ baseUrl: env.VITE_API_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} stylesTransform={emotionTransform}>
        <MantineEmotionProvider>
          <ModalsProvider>
            <Notifications />
            <App />
          </ModalsProvider>
        </MantineEmotionProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>
)
