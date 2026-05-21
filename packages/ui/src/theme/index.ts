import {
  createTheme as createMantineTheme,
  type MantineTheme,
  type MantineThemeOverride,
} from '@mantine/core'

export function createTheme(
  overrides: MantineThemeOverride = {}
): ReturnType<typeof createMantineTheme> {
  return createMantineTheme({
    fontFamily: 'Geist Variable, sans-serif',
    headings: {
      fontFamily: 'Plus Jakarta Sans Variable, sans-serif',
    },
    focusRing: 'auto',
    defaultRadius: 'md',
    components: {
      Input: {
        styles: (theme: MantineTheme) => ({
          wrapper: {
            overflow: 'visible',
            borderRadius: theme.radius.sm,
            '&:focus-within': {
              outline: `2px solid ${theme.colors.main[6]}`,
              outlineOffset: '2px',
            },
            '&:has([aria-invalid="true"]):focus-within': {
              outline: `2px solid ${theme.colors.red[6]}`,
            },
          },
          input: {
            borderRadius: theme.radius.sm,
          },
        }),
      },
      Button: {
        styles: (
          theme: MantineTheme,
          props: { size?: string; variant?: string }
        ) => ({
          root: {
            fontSize: '14px',
            ...(props.size === 'xs' && { fontWeight: 500 }),
            ...(props.variant === 'secondary' && {
              color: theme.colors.gray[8],
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.gray[4]}`,
              '&:hover': {
                color: theme.colors.gray[8],
                backgroundColor: theme.colors.gray[2],
              },
            }),
          },
        }),
      },
      Modal: {
        defaultProps: { radius: 'lg' },
        styles: {
          title: {
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
          },
        },
      },
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
