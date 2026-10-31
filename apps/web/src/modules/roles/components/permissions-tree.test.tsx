import type {
  PermissionAction,
  ResourceDefinition,
} from '@helix/api-client/types'
import { MantineProvider } from '@helix/ui'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PermissionsTree } from './permissions-tree'

type Grants = Record<string, PermissionAction[]>

const definitions: ResourceDefinition[] = [
  {
    resource: 'todos',
    label: 'Todos',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  { resource: 'audit', label: 'Audit Log', actions: ['view'] },
]

function renderTree(grants: Grants, options: { disabled?: boolean } = {}) {
  const onChange = vi.fn()
  render(
    <MantineProvider>
      <PermissionsTree
        definitions={definitions}
        grants={grants}
        onChange={onChange}
        disabled={options.disabled}
      />
    </MantineProvider>
  )
  return onChange
}

function StatefulTree(props: Readonly<{ initial: Grants }>) {
  const { initial } = props
  const [grants, setGrants] = useState(initial)

  return (
    <PermissionsTree
      definitions={definitions}
      grants={grants}
      onChange={setGrants}
    />
  )
}

function resourceCheckbox(label: string) {
  return screen.getByRole('checkbox', { name: label })
}

function actionCheckbox(resourceLabel: string, action: string) {
  const card = resourceCheckbox(resourceLabel).closest<HTMLElement>(
    '.mantine-Paper-root'
  )!
  return within(card).getByRole('checkbox', { name: action })
}

describe('PermissionsTree', () => {
  it('renders one group per resource with its actions', () => {
    renderTree({})
    expect(resourceCheckbox('Todos')).toBeInTheDocument()
    expect(resourceCheckbox('Audit Log')).toBeInTheDocument()
    for (const action of ['View', 'Create', 'Edit', 'Delete']) {
      expect(actionCheckbox('Todos', action)).toBeInTheDocument()
    }
    expect(actionCheckbox('Audit Log', 'View')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
  })

  it('checks the actions present in grants', () => {
    renderTree({ todos: ['view', 'edit'] })
    expect(actionCheckbox('Todos', 'View')).toBeChecked()
    expect(actionCheckbox('Todos', 'Edit')).toBeChecked()
    expect(actionCheckbox('Todos', 'Create')).not.toBeChecked()
    expect(actionCheckbox('Todos', 'Delete')).not.toBeChecked()
  })

  it('checks the resource checkbox only when every action is granted', () => {
    renderTree({ todos: ['view', 'edit'], audit: ['view'] })
    expect(resourceCheckbox('Todos')).not.toBeChecked()
    expect(resourceCheckbox('Audit Log')).toBeChecked()
  })

  it('marks the resource checkbox indeterminate when some actions are granted', () => {
    renderTree({ todos: ['view'] })
    expect(resourceCheckbox('Todos')).toHaveAttribute('data-indeterminate')
    expect(resourceCheckbox('Audit Log')).not.toHaveAttribute(
      'data-indeterminate'
    )
  })

  it('grants an action when its checkbox is clicked', async () => {
    const onChange = renderTree({ todos: ['view'], audit: ['view'] })
    await userEvent.click(actionCheckbox('Todos', 'Delete'))
    expect(onChange).toHaveBeenCalledWith({
      todos: ['view', 'delete'],
      audit: ['view'],
    })
  })

  it('revokes an action when its checked checkbox is clicked', async () => {
    const onChange = renderTree({ todos: ['view', 'edit'] })
    await userEvent.click(actionCheckbox('Todos', 'View'))
    expect(onChange).toHaveBeenCalledWith({ todos: ['edit'] })
  })

  it('grants every action when the resource checkbox is clicked', async () => {
    const onChange = renderTree({ todos: ['view'] })
    await userEvent.click(resourceCheckbox('Todos'))
    expect(onChange).toHaveBeenCalledWith({
      todos: ['view', 'create', 'edit', 'delete'],
    })
  })

  it('revokes every action when a fully checked resource is clicked', async () => {
    const onChange = renderTree({
      todos: ['view', 'create', 'edit', 'delete'],
    })
    await userEvent.click(resourceCheckbox('Todos'))
    expect(onChange).toHaveBeenCalledWith({ todos: [] })
  })

  it('updates the resource checkbox as actions are toggled', async () => {
    render(
      <MantineProvider>
        <StatefulTree initial={{ audit: [] }} />
      </MantineProvider>
    )
    expect(resourceCheckbox('Audit Log')).not.toBeChecked()
    await userEvent.click(actionCheckbox('Audit Log', 'View'))
    expect(resourceCheckbox('Audit Log')).toBeChecked()
  })

  it('disables every checkbox and ignores clicks when disabled', async () => {
    const onChange = renderTree({ todos: ['view'] }, { disabled: true })
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled()
    }
    await userEvent.click(actionCheckbox('Todos', 'Edit'))
    await userEvent.click(resourceCheckbox('Todos'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
