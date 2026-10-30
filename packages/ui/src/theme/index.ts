import {
  createTheme as createMantineTheme,
  type MantineTheme,
  type MantineThemeOverride,
  rem,
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
    // 4/8px grid — Mantine's default uses 10px (xs) and 20px (lg)
    spacing: {
      xs: rem(8),
      sm: rem(12),
      md: rem(16),
      lg: rem(24),
      xl: rem(32),
    },
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
        styles: (_theme: MantineTheme, props: { size?: string }) => ({
          root: {
            fontSize: '14px',
            ...(props.size === 'xs' && { fontWeight: 500 }),
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

          return {
            root: {
              borderRadius: theme.radius.lg,
              border: `1px solid light-dark(${theme.colors.gray[2]}, ${theme.colors.dark[4]})`,
              boxShadow:
                'light-dark(0 4px 16px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.3))',
              backgroundColor: `light-dark(${theme.white}, ${theme.colors.dark[6]})`,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            },
            icon: {
              backgroundColor: `light-dark(${palette[1]}, ${palette[8]})`,
              color: `light-dark(${palette[6]}, ${palette[3]})`,
              borderRadius: theme.radius.md,
              width: '32px',
              height: '32px',
              minWidth: '32px',
            },
            title: {
              fontWeight: 600,
              fontSize: '16px',
              color: `light-dark(${theme.colors.dark[9]}, ${theme.colors.dark[0]})`,
              lineHeight: '1.4',
              marginBottom: '4px',
            },
            description: {
              fontSize: '14px',
              color: `light-dark(${theme.colors.dark[6]}, ${theme.colors.dark[1]})`,
              lineHeight: '1.5',
            },
            closeButton: {
              color: `light-dark(${theme.colors.gray[7]}, ${theme.colors.dark[2]})`,
              borderRadius: theme.radius.sm,
              '&:hover': {
                backgroundColor: `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[5]})`,
                color: `light-dark(${theme.colors.gray[9]}, ${theme.white})`,
              },
            },
          }
        },
      },
    },
    ...overrides,
  })
}
