import { configure } from '@helix/api-client'
import {
  emotionTransform,
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
  Notifications,
} from '@helix/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app.tsx'
import { theme } from './config/theme'
import { env } from './env'

configure({ baseUrl: env.VITE_API_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} stylesTransform={emotionTransform}>
      <MantineEmotionProvider>
        <ModalsProvider>
          <Notifications />
          <App />
        </ModalsProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  </StrictMode>
)
