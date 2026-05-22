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

import { RoleCreateDrawer } from './role-create-drawer'

export type RoleSelectFieldProps = Omit<SelectProps, 'data'> & {
  allowCreate?: boolean
}

export function RoleSelectField(props: Readonly<RoleSelectFieldProps>) {
  const { allowCreate, onChange, className, ...selectProps } = props

  const { data: roles } = useGetRolesAllSuspense()
  const { classes, cx } = useStyles()
  const [opened, { open, close }] = useDisclosure(false)

  const select = (
    <Select
      data={roles.map((role) => ({ value: String(role.id), label: role.name }))}
      label="Role"
      placeholder="Pick one"
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
        <Tooltip label="Create role">
          <Button
            variant="default"
            leftSection={<IconPlus size={16} />}
            aria-label="Create role"
            onClick={open}
          >
            Create related role
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
