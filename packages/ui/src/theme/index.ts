import {
  createTheme as createMantineTheme,
  type MantineThemeOverride,
} from '@mantine/core'

export function createTheme(
  overrides: MantineThemeOverride = {}
): ReturnType<typeof createMantineTheme> {
  return createMantineTheme({
    fontFamily: 'Inter Variable, sans-serif',
    headings: {
      fontFamily: 'Plus Jakarta Sans Variable, sans-serif',
    },
    defaultRadius: 'md',
    ...overrides,
  })
}
