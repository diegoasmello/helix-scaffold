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
      Drawer: {
        defaultProps: { offset: 8, radius: 'md' },
        styles: {
          title: { fontWeight: 500 },
        },
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
      Notification: {
        styles: (theme: MantineTheme, props: { color?: string }) => {
          const colorKey = (props.color ?? 'main') as keyof typeof theme.colors
          const palette = theme.colors[colorKey] ?? theme.colors.main
          const accent = palette[6]
          const accentLight = palette[1]

          return {
            root: {
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.colors.gray[2]}`,
              boxShadow:
                '0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
              backgroundColor: theme.white,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            },
            icon: {
              backgroundColor: accentLight,
              color: accent,
              borderRadius: theme.radius.md,
              width: '32px',
              height: '32px',
              minWidth: '32px',
            },
            title: {
              fontWeight: 600,
              fontSize: '16px',
              color: theme.colors.dark[9],
              lineHeight: '1.4',
              marginBottom: '2px',
            },
            description: {
              fontSize: '14px',
              color: theme.colors.dark[6],
              lineHeight: '1.5',
            },
            closeButton: {
              color: theme.colors.gray[7],
              borderRadius: theme.radius.sm,
              '&:hover': {
                backgroundColor: theme.colors.gray[1],
                color: theme.colors.gray[9],
              },
            },
          }
        },
      },
    },
    ...overrides,
  })
}
