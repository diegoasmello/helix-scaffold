import { useGetRolesAllSuspense } from '@helix/api-client/hooks'
import {
  Button,
  createStyles,
  css,
  IconPlus,
  Select,
  type SelectProps,
  Stack,
  Tooltip,
  useDisclosure,
} from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { RoleCreateDrawer } from './role-create-drawer'

export type RoleSelectFieldProps = Omit<SelectProps, 'data'> & {
  allowCreate?: boolean
}

export function RoleSelectField(props: Readonly<RoleSelectFieldProps>) {
  const { allowCreate, onChange, className, ...selectProps } = props

  const { data: roles } = useGetRolesAllSuspense()
  const { classes, cx } = useStyles()
  const [opened, { open, close }] = useDisclosure(false)
  const { t } = useTranslation('roles')

  const select = (
    <Select
      data={roles.map((role) => ({ value: String(role.id), label: role.name }))}
      label={t('form.roleSelect.label')}
      placeholder={t('form.roleSelect.placeholder')}
      searchable
      clearable
      onChange={onChange}
      className={allowCreate ? cx(classes.select, className) : className}
      {...selectProps}
    />
  )

  if (!allowCreate) return select

  return (
    <>
      <Stack align="flex-start" gap="xs">
        {select}
        <Tooltip label={t('form.roleSelect.createTooltip')}>
          <Button
            variant="default"
            leftSection={<IconPlus size={16} />}
            aria-label="Create role"
            onClick={open}
          >
            {t('form.roleSelect.createLabel')}
          </Button>
        </Tooltip>
      </Stack>
      <RoleCreateDrawer
        opened={opened}
        onClose={close}
        onSuccess={(roleId) => onChange?.(roleId, { value: roleId, label: '' })}
      />
    </>
  )
}

const useStyles = createStyles(() => ({
  select: css`
    width: 100%;
  `,
}))
