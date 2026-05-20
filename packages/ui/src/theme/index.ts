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
          input: {
            borderRadius: theme.radius.sm,
            '&:focus, &:focus-visible': {
              outline: '2px solid var(--mantine-primary-color-filled)',
              outlineOffset: 'calc(0.125rem * var(--mantine-scale))',
            },
            '&[aria-invalid="true"]:focus, &[aria-invalid="true"]:focus-visible': {
              outline: '2px solid var(--mantine-color-error)',
            },
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
