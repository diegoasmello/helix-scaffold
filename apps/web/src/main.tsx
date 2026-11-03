import './i18n'

import { configure } from '@helix/api-client'
import {
  emotionTransform,
  localStorageColorSchemeManager,
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
import { API_URL } from './lib/api-url'
import { queryClient } from './lib/query-client.ts'
import { router } from './routes.ts'

configure({ baseUrl: API_URL })

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'helix-color-scheme',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={theme}
        stylesTransform={emotionTransform}
        colorSchemeManager={colorSchemeManager}
      >
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
