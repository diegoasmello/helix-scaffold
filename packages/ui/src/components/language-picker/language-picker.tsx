import { css } from '@emotion/react'
import { Group, Menu, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronDown } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

const data = [
  { label: 'English', value: 'en' },
  { label: 'Português (Brasil)', value: 'pt-BR' },
]

export function LanguagePicker() {
  const { classes } = useStyles()
  const { i18n } = useTranslation()

  const selected =
    data.find((d) => d.value === i18n.resolvedLanguage) ?? data[0]

  const items = data.map((item) => (
    <Menu.Item onClick={() => i18n.changeLanguage(item.value)} key={item.value}>
      {item.label}
    </Menu.Item>
  ))

  return (
    <Menu radius="md" width="target" withinPortal>
      <Menu.Target>
        <UnstyledButton className={classes.control}>
          <Group gap="xs">
            <span className={classes.label}>{selected.label}</span>
          </Group>
          <IconChevronDown size={16} className={classes.icon} stroke={1.5} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>{items}</Menu.Dropdown>
    </Menu>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  control: css`
    width: 8rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    border-radius: ${theme.radius.md};
    transition: background-color 150ms ease;

    ${u.light} {
      border: 1px solid ${theme.colors.gray[2]};
      background-color: ${theme.white};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[6]};
      background-color: ${theme.colors.dark[6]};
    }

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[0]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
    }
  `,
  label: css`
    font-weight: 500;
    font-size: ${theme.fontSizes.sm};
  `,
  icon: css`
    transition: transform 150ms ease;
    transform: rotate(0deg);
  `,
}))
