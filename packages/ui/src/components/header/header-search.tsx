import { css } from '@emotion/react'
import { ActionIcon, Kbd, Modal, TextInput, Tooltip } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { useDisclosure, useHotkeys } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface HeaderSearchProps {
  /** Called with the trimmed query when the user presses Enter. */
  onSearch: (query: string) => void
  placeholder?: string
}

/**
 * The global search field of the header. From `md` up it is a pill input
 * (`Ctrl K` focuses it); below `md` it collapses into an icon that opens the
 * field in a dialog. It only collects the query — `onSearch` decides what to
 * do with it.
 */
export function HeaderSearch(props: Readonly<HeaderSearchProps>) {
  const { onSearch, placeholder } = props

  const { t } = useTranslation('ui')
  const { classes } = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [dialogOpened, dialog] = useDisclosure(false)

  useHotkeys([['mod+K', () => inputRef.current?.focus()]])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    onSearch(trimmed)
    dialog.close()
  }

  const label = placeholder ?? t('search.placeholder')

  const input = (autoFocus: boolean) => (
    <form role="search" onSubmit={handleSubmit} className={classes.form}>
      <TextInput
        ref={autoFocus ? undefined : inputRef}
        data-autofocus={autoFocus || undefined}
        type="search"
        aria-label={t('search.label')}
        placeholder={label}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<IconSearch size={18} stroke={1.7} />}
        rightSection={
          autoFocus ? undefined : (
            <Kbd className={classes.kbd}>{t('search.shortcut')}</Kbd>
          )
        }
        rightSectionWidth={72}
        classNames={{ input: classes.input }}
      />
    </form>
  )

  return (
    <>
      <div className={classes.desktop}>{input(false)}</div>
      <Tooltip label={t('search.open')} position="bottom">
        <ActionIcon
          variant="subtle"
          color="gray"
          size={44}
          radius="xl"
          aria-label={t('search.open')}
          onClick={dialog.open}
          className={classes.mobile}
        >
          <IconSearch size={21} stroke={1.7} />
        </ActionIcon>
      </Tooltip>
      <Modal
        opened={dialogOpened}
        onClose={dialog.close}
        title={t('search.label')}
        yOffset="10vh"
      >
        {input(true)}
      </Modal>
    </>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  form: css`
    width: 100%;
  `,
  desktop: css`
    flex: 1;
    max-width: 480px;

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      display: none;
    }
  `,
  mobile: css`
    @media (min-width: ${theme.breakpoints.md}) {
      display: none;
    }
  `,
  input: css`
    height: 42px;
    border-radius: 999px;
    font-size: 14.5px;
    ${u.light} {
      background-color: ${theme.colors.gray[0]};
      border-color: ${theme.colors.gray[3]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[6]};
      border-color: ${theme.colors.dark[5]};
    }
  `,
  kbd: css`
    border-radius: 999px;
    font-size: 12px;
    padding: 2px 10px;
    border-bottom-width: 1px;
  `,
}))
