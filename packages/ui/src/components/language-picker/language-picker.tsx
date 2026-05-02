import { css } from '@emotion/react'
import { Group, Menu, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronDown } from '@tabler/icons-react'
import { useState } from 'react'

export function LanguagePicker() {
  const { classes } = useStyles()

  const [opened, setOpened] = useState(false)
  const [selected, setSelected] = useState(data[0])
  const items = data.map((item) => (
    <Menu.Item
      // leftSection={<Image src={item.image} width={18} height={18} alt="" />}
      onClick={() => setSelected(item)}
      key={item.label}
    >
      {item.label}
    </Menu.Item>
  ))

  return (
    <Menu
      onOpen={() => setOpened(true)}
      onClose={() => setOpened(false)}
      radius="md"
      width="target"
      withinPortal
    >
      <Menu.Target>
        <UnstyledButton
          className={classes.control}
          data-expanded={opened || undefined}
        >
          <Group gap="xs">
            {/* <Image src={selected.image} w={22} h={22} alt="" /> */}
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

    &[data-expanded] {
      ${u.light} {
        background-color: ${theme.colors.gray[0]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
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

    [data-expanded] & {
      transform: rotate(180deg);
    }
  `,
}))

// const data = [
//   { label: 'English', image: images.english },
//   { label: 'German', image: images.german },
//   { label: 'Italian', image: images.italian },
//   { label: 'French', image: images.french },
//   { label: 'Polish', image: images.polish },
// ];

const data = [
  { label: 'English' },
  { label: 'German' },
  { label: 'Italian' },
  { label: 'French' },
  { label: 'Polish' },
]
