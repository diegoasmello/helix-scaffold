import { useGetRolesSuspense } from '@helix/api-client/hooks'
import { Select, type SelectProps } from '@helix/ui'

export type RoleSelectFieldProps = Omit<SelectProps, 'data'>

export function RoleSelectField(props: Readonly<RoleSelectFieldProps>) {
  const { data: roles } = useGetRolesSuspense()

  return (
    <Select
      data={roles.map((role) => ({ value: String(role.id), label: role.name }))}
      label="Role"
      placeholder="Pick one"
      searchable
      clearable
      {...props}
    />
  )
}
