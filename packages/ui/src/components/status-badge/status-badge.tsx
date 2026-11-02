import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface StatusBadgeProps {
  /** What the state means: done/active, waiting, failed, informative, inactive. */
  tone: StatusTone
  /** The state in words — the tone is never the only signal. */
  children: ReactNode
}

/**
 * A record's state: a soft pill with a dot and the state's name. The tones
 * are fixed (not Mantine palettes) so every one keeps 4.5:1 text contrast in
 * both color schemes — Mantine's yellow/orange light variants do not.
 */
export function StatusBadge(props: Readonly<StatusBadgeProps>) {
  const { tone, children } = props

  const { classes, cx } = useStyles()

  return (
    <span className={cx(classes.badge, classes[tone])}>
      <span aria-hidden className={classes.dot} />
      {children}
    </span>
  )
}

// [background, border, text, dot] per scheme
const TONES: Record<StatusTone, { light: string[]; dark: string[] }> = {
  success: {
    light: ['#ecfdf3', '#abefc6', '#067647', '#17b26a'],
    dark: [
      'rgba(23, 178, 106, 0.12)',
      'rgba(71, 205, 137, 0.3)',
      '#75e0a7',
      '#47cd89',
    ],
  },
  warning: {
    light: ['#fffaeb', '#fde7b0', '#93370d', '#f79009'],
    dark: [
      'rgba(247, 144, 9, 0.12)',
      'rgba(253, 176, 34, 0.3)',
      '#fec84b',
      '#fdb022',
    ],
  },
  danger: {
    light: ['#fef3f2', '#fecdca', '#b42318', '#f04438'],
    dark: [
      'rgba(240, 68, 56, 0.12)',
      'rgba(249, 112, 102, 0.3)',
      '#fda29b',
      '#f97066',
    ],
  },
  info: {
    light: ['#eef4ff', '#c7d7fe', '#0032b1', '#0a51f9'],
    dark: [
      'rgba(10, 81, 249, 0.16)',
      'rgba(125, 160, 255, 0.3)',
      '#9db9ff',
      '#7aa2ff',
    ],
  },
  neutral: {
    light: ['#fafafa', '#e4e4e7', '#3f3f46', '#a1a1aa'],
    dark: ['#18181b', '#3f3f46', '#d4d4d8', '#a1a1aa'],
  },
}

const toneClass = (tone: StatusTone, light: string, dark: string) => {
  const [lBg, lBorder, lText, lDot] = TONES[tone].light
  const [dBg, dBorder, dText, dDot] = TONES[tone].dark
  return css`
    ${light} {
      background-color: ${lBg};
      border-color: ${lBorder};
      color: ${lText};
      --status-dot: ${lDot};
    }
    ${dark} {
      background-color: ${dBg};
      border-color: ${dBorder};
      color: ${dText};
      --status-dot: ${dDot};
    }
  `
}

const useStyles = createStyles((theme, _, u) => ({
  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 26px;
    box-sizing: border-box;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    font-family: ${theme.fontFamily};
  `,
  dot: css`
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 999px;
    background-color: var(--status-dot);
  `,
  success: toneClass('success', u.light, u.dark),
  warning: toneClass('warning', u.light, u.dark),
  danger: toneClass('danger', u.light, u.dark),
  info: toneClass('info', u.light, u.dark),
  neutral: toneClass('neutral', u.light, u.dark),
}))
