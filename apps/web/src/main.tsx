import { configure } from '@helix/api-client'
import {
  configureValidatorMessages,
  emotionTransform,
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
  Notifications,
} from '@helix/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { theme } from './config/theme'
import { env } from './env'
import i18n from './i18n'
import { queryClient } from './lib/query-client.ts'
import { router } from './routes.ts'

configure({ baseUrl: env.VITE_API_URL })

configureValidatorMessages(
  i18n.t.bind(i18n) as (key: string, opts?: Record<string, unknown>) => string
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} stylesTransform={emotionTransform}>
        <MantineEmotionProvider>
          <ModalsProvider
            modalProps={{
              transitionProps: {
                transition: 'pop',
              },
            }}
          >
            <Notifications
              position="bottom-right"
              containerWidth={380}
              limit={5}
            />
            <RouterProvider router={router} />
          </ModalsProvider>
        </MantineEmotionProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>
)
