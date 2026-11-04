import type {
  PermissionAction,
  PermissionResource,
  ResourceDefinition,
} from '@helix/api-client/types'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../../i18n'
import {
  type MissingRequirement,
  missingRequirements,
} from '../permission-requirements'
import { PermissionsTree } from './permissions-tree'

type Grants = Record<string, PermissionAction[]>

const definitions: ResourceDefinition[] = [
  {
    resource: 'todos',
    label: 'Todos',
    actions: ['view', 'create', 'edit', 'delete'],
    requires: {},
  },
  // `label` is the API catalog's English label; the UI shows the translation
  { resource: 'audit', label: 'Audit', actions: ['view'], requires: {} },
]

// The real catalog's chain: permissions:edit → permissions:view → roles:view
const withRequirements: ResourceDefinition[] = [
  {
    resource: 'roles',
    label: 'Roles',
    actions: ['view', 'edit'],
    requires: { edit: [{ resource: 'roles', action: 'view' }] },
  },
  {
    resource: 'permissions',
    label: 'Permissions',
    actions: ['view', 'edit'],
    requires: {
      view: [{ resource: 'roles', action: 'view' }],
      edit: [{ resource: 'permissions', action: 'view' }],
    },
  },
]

function renderTree(
  grants: Grants,
  options: {
    disabled?: boolean
    catalog?: ResourceDefinition[]
    canGrant?: (resource: string, action: string) => boolean
    missing?: MissingRequirement[]
  } = {}
) {
  const onChange = vi.fn()
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <PermissionsTree
          definitions={options.catalog ?? definitions}
          grants={grants}
          onChange={onChange}
          disabled={options.disabled}
          canGrant={options.canGrant}
          missing={options.missing}
        />
      </MantineEmotionProvider>
    </MantineProvider>
  )
  return onChange
}

function StatefulTree(
  props: Readonly<{ initial: Grants; catalog?: ResourceDefinition[] }>
) {
  const { initial, catalog = definitions } = props
  const [grants, setGrants] = useState(initial)

  return (
    <PermissionsTree
      definitions={catalog}
      grants={grants}
      onChange={setGrants}
    />
  )
}

function resourceCheckbox(label: string) {
  return screen.getByRole('checkbox', { name: label })
}

function actionCheckbox(resourceLabel: string, action: string) {
  const group = screen.getByRole('group', { name: resourceLabel })
  return within(group).getByRole('checkbox', { name: action })
}

describe('PermissionsTree', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('falls back to the catalog label for a resource without a translation', () => {
    render(
      <MantineProvider>
        <MantineEmotionProvider>
          <PermissionsTree
            definitions={[
              {
                // A resource just added to the API catalog, with no label yet
                resource: 'reports' as PermissionResource,
                label: 'Reports',
                actions: ['view'],
                requires: {},
              },
            ]}
            grants={{}}
            onChange={vi.fn()}
          />
        </MantineEmotionProvider>
      </MantineProvider>
    )
    expect(resourceCheckbox('Reports')).toBeInTheDocument()
  })

  it('translates resource and action labels', async () => {
    await i18n.changeLanguage('pt-BR')
    renderTree({})
    expect(resourceCheckbox('Tarefas')).toBeInTheDocument()
    expect(actionCheckbox('Tarefas', 'Excluir')).toBeInTheDocument()
  })

  it('renders one group per resource with its actions', () => {
    renderTree({})
    expect(resourceCheckbox('Todos')).toBeInTheDocument()
    expect(resourceCheckbox('Audit log')).toBeInTheDocument()
    for (const action of ['View', 'Create', 'Edit', 'Delete']) {
      expect(actionCheckbox('Todos', action)).toBeInTheDocument()
    }
    expect(actionCheckbox('Audit log', 'View')).toBeInTheDocument()
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
    expect(resourceCheckbox('Audit log')).toBeChecked()
  })

  it('marks the resource checkbox indeterminate when some actions are granted', () => {
    renderTree({ todos: ['view'] })
    expect(resourceCheckbox('Todos')).toHaveAttribute('data-indeterminate')
    expect(resourceCheckbox('Audit log')).not.toHaveAttribute(
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
        <MantineEmotionProvider>
          <StatefulTree initial={{ audit: [] }} />
        </MantineEmotionProvider>
      </MantineProvider>
    )
    expect(resourceCheckbox('Audit log')).not.toBeChecked()
    await userEvent.click(actionCheckbox('Audit log', 'View'))
    expect(resourceCheckbox('Audit log')).toBeChecked()
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

  describe('requirements', () => {
    function renderStateful(initial: Grants) {
      render(
        <MantineProvider>
          <MantineEmotionProvider>
            <StatefulTree initial={initial} catalog={withRequirements} />
          </MantineEmotionProvider>
        </MantineProvider>
      )
    }

    it('checks what an action requires, transitively', async () => {
      renderStateful({})
      await userEvent.click(actionCheckbox('Permissions', 'Edit'))
      expect(actionCheckbox('Permissions', 'Edit')).toBeChecked()
      expect(actionCheckbox('Permissions', 'View')).toBeChecked()
      expect(actionCheckbox('Roles', 'View')).toBeChecked()
      expect(actionCheckbox('Roles', 'Edit')).not.toBeChecked()
    })

    it('unchecks what depends on an unchecked action, transitively', async () => {
      renderStateful({ roles: ['view', 'edit'], permissions: ['view', 'edit'] })
      await userEvent.click(actionCheckbox('Roles', 'View'))
      for (const [resource, action] of [
        ['Roles', 'View'],
        ['Roles', 'Edit'],
        ['Permissions', 'View'],
        ['Permissions', 'Edit'],
      ]) {
        expect(actionCheckbox(resource, action)).not.toBeChecked()
      }
    })

    it('applies them to the resource checkbox too', async () => {
      renderStateful({})
      await userEvent.click(resourceCheckbox('Permissions'))
      expect(actionCheckbox('Roles', 'View')).toBeChecked()

      await userEvent.click(resourceCheckbox('Roles'))
      await userEvent.click(resourceCheckbox('Roles'))
      expect(actionCheckbox('Permissions', 'View')).not.toBeChecked()
    })

    it('explains the requirements on hover', async () => {
      renderStateful({})
      await userEvent.hover(actionCheckbox('Permissions', 'Edit'))
      expect(
        await screen.findByText('Requires: Permissions › View, Roles › View')
      ).toBeInTheDocument()
    })
  })

  describe('privilege ceiling', () => {
    // The user's own role holds todos:view and todos:edit only
    const canGrant = (resource: string, action: string) =>
      resource === 'todos' && (action === 'view' || action === 'edit')

    it('disables the unchecked actions the user may not grant', () => {
      renderTree({ todos: ['view', 'delete'] }, { canGrant })
      expect(actionCheckbox('Todos', 'Edit')).toBeEnabled()
      expect(actionCheckbox('Todos', 'Create')).toBeDisabled()
      // Checked: unchecking it never grants anything
      expect(actionCheckbox('Todos', 'Delete')).toBeEnabled()
      expect(resourceCheckbox('Audit log')).toBeDisabled()
    })

    it('checks only what the user may grant from the resource checkbox', async () => {
      const onChange = renderTree({}, { canGrant })
      await userEvent.click(resourceCheckbox('Todos'))
      expect(onChange).toHaveBeenCalledWith({ todos: ['view', 'edit'] })
    })

    it('unchecks the resource once nothing is left to grant', async () => {
      const onChange = renderTree({ todos: ['view', 'edit'] }, { canGrant })
      await userEvent.click(resourceCheckbox('Todos'))
      expect(onChange).toHaveBeenCalledWith({ todos: [] })
    })
  })

  describe('missing requirements', () => {
    it('highlights each one with what needs it', () => {
      const grants = { permissions: ['view' as const] }
      renderTree(grants, {
        catalog: withRequirements,
        missing: missingRequirements(grants, withRequirements),
      })
      expect(
        screen.getByText('Check it: Permissions › View needs it')
      ).toBeInTheDocument()
    })

    it('highlights nothing unless told (the read-only detail)', () => {
      renderTree({ permissions: ['view'] }, { catalog: withRequirements })
      expect(screen.queryByText(/needs it/)).not.toBeInTheDocument()
    })
  })

  it('explains on hover what needs an action', async () => {
    renderTree({}, { catalog: withRequirements })
    await userEvent.hover(actionCheckbox('Roles', 'View'))
    expect(
      await screen.findByText(
        'Needed for: Roles › Edit, Permissions › View, Permissions › Edit'
      )
    ).toBeInTheDocument()
  })
})
