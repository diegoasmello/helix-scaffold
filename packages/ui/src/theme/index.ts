import {
  createTheme as createMantineTheme,
  type MantineColorsTuple,
  type MantineTheme,
  type MantineThemeOverride,
  rem,
} from '@mantine/core'

/**
 * Neutral palettes (zinc). They replace Mantine's `gray` and `dark` because
 * Mantine reads them by index: `gray[6]` is the light-mode `dimmed` text
 * (#71717a passes 4.5:1 on white), `gray[4]` the input/default-button border,
 * `dark[7]` the dark-mode body and `dark[4]` its borders.
 */
const gray: MantineColorsTuple = [
  '#fafafa',
  '#f4f4f5',
  '#ececee',
  '#e4e4e7',
  '#d4d4d8',
  '#a1a1aa',
  '#71717a',
  '#52525b',
  '#3f3f46',
  '#18181b',
]

const dark: MantineColorsTuple = [
  '#f4f4f5',
  '#d4d4d8',
  '#a1a1aa',
  '#8b8b94',
  '#3f3f46',
  '#27272a',
  '#18181b',
  '#0b0b0d',
  '#09090b',
  '#050506',
]

const none = 'none'

export function createTheme(
  overrides: MantineThemeOverride = {}
): ReturnType<typeof createMantineTheme> {
  const { colors, ...rest } = overrides

  return createMantineTheme({
    fontFamily: 'Geist Variable, sans-serif',
    headings: {
      fontFamily: 'Geist Variable, sans-serif',
      fontWeight: '600',
      sizes: {
        h1: { fontSize: rem(30), lineHeight: '1.2' },
        h2: { fontSize: rem(18), lineHeight: '1.35' },
        h3: { fontSize: rem(16), lineHeight: '1.4' },
        h4: { fontSize: rem(15), lineHeight: '1.45' },
      },
    },
    colors: { gray, dark, ...colors },
    focusRing: 'auto',
    defaultRadius: 'md',
    radius: {
      xs: rem(4),
      sm: rem(6),
      md: rem(8),
      lg: rem(12),
      xl: rem(16),
    },
    // 4/8px grid — Mantine's default uses 10px (xs) and 20px (lg)
    spacing: {
      xs: rem(8),
      sm: rem(12),
      md: rem(16),
      lg: rem(24),
      xl: rem(32),
    },
    // `md` at 1024px: below it the sidebar becomes a drawer and the app
    // switches to its compact header.
    breakpoints: {
      xs: '36em',
      sm: '48em',
      md: '64em',
      lg: '75em',
      xl: '88em',
    },
    // Surfaces are separated by 1px borders, never by shadows.
    shadows: { xs: none, sm: none, md: none, lg: none, xl: none },
    components: {
      Title: {
        styles: (_theme: MantineTheme, props: { order?: number }) => ({
          root: {
            ...(props.order === 1 && { letterSpacing: '-0.025em' }),
          },
        }),
      },
      Input: {
        styles: (theme: MantineTheme) => ({
          wrapper: {
            overflow: 'visible',
            borderRadius: theme.radius.md,
            '&:focus-within': {
              outline: `2px solid ${theme.colors.main[6]}`,
              outlineOffset: '2px',
              animation: 'var(--helix-focus-ring-animation)',
            },
            '&:has([aria-invalid="true"]):focus-within': {
              outline: `2px solid ${theme.colors.red[6]}`,
            },
          },
          input: {
            borderRadius: theme.radius.md,
          },
        }),
      },
      Button: {
        // `variant="default"` ignores `color`; with `color="red"` it becomes
        // the bordered destructive button (Delete next to Edit).
        styles: (
          theme: MantineTheme,
          props: { size?: string; variant?: string; color?: string }
        ) => ({
          root: {
            fontSize: '14px',
            fontWeight: 500,
            ...(props.size === 'xs' && { fontSize: '13.5px' }),
            ...(props.variant === 'default' &&
              props.color === 'red' && {
                color: `light-dark(${theme.colors.red[7]}, ${theme.colors.red[4]})`,
              }),
          },
        }),
      },
      Paper: {
        defaultProps: { withBorder: true, radius: 'lg' },
      },
      Drawer: {
        defaultProps: { offset: 8, radius: 'lg' },
        styles: {
          title: { fontWeight: 600 },
        },
      },
      Modal: {
        defaultProps: { radius: 'lg' },
        styles: (theme: MantineTheme) => ({
          content: {
            border: `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
          },
          title: {
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
          },
        }),
      },
      Menu: {
        defaultProps: { radius: 'lg' },
        styles: {
          item: { minHeight: rem(36) },
        },
      },
      Badge: {
        defaultProps: { variant: 'light', radius: 'xl' },
        // Small counters (`size="xs"`, `circle`) keep Mantine's own geometry.
        styles: (
          _theme: MantineTheme,
          props: { size?: string; circle?: boolean }
        ) =>
          props.circle || (props.size && props.size !== 'md')
            ? { root: { textTransform: 'none' } }
            : {
                root: {
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  padding: '0 10px',
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
              border: `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
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
              color: `light-dark(${theme.colors.gray[9]}, ${theme.colors.dark[0]})`,
              lineHeight: '1.4',
              marginBottom: '4px',
            },
            description: {
              fontSize: '14px',
              color: `light-dark(${theme.colors.gray[7]}, ${theme.colors.dark[1]})`,
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
    ...rest,
  })
}
