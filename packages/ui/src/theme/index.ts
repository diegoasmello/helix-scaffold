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
    components: {
      Badge: {
        defaultProps: { variant: 'light' },
        styles: {
          root: {
            textTransform: 'capitalize',
            fontSize: '0.825rem',
            fontWeight: 500,
            padding: '0 8px',
            borderRadius: '4px',
            height: '26px',
          },
        },
      },
    },
    ...overrides,
  })
}
