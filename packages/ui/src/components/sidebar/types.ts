import type { IconProps } from '@tabler/icons-react'
import type { RegisteredRouter } from '@tanstack/react-router'
import type { FC, RefAttributes } from 'react'

// Traverses the full route tree (mirrors @tanstack/router-core's ParseRoute).
// ParseRoute is not exported from @tanstack/react-router, so we replicate it.
type ParseRoute<TRouteTree, TAcc = TRouteTree> = TRouteTree extends {
  types: { children: infer TChildren }
}
  ? unknown extends TChildren
    ? TAcc
    : TChildren extends ReadonlyArray<unknown>
      ? ParseRoute<TChildren[number], TAcc | TChildren[number]>
      : ParseRoute<
          TChildren[keyof TChildren],
          TAcc | TChildren[keyof TChildren]
        >
  : TAcc

// An index route's fullPath ends in `/` (`/me/`), but `to` takes `/me`.
type WithoutTrailingSlash<P extends string> = P extends `${infer Base}/`
  ? Base extends ''
    ? '/'
    : Base
  : P

// Valid navigable app routes — pathless layout routes (e.g. authenticated)
// are excluded because their fullPath collapses to the parent's path.
type AppRoute =
  ParseRoute<RegisteredRouter['routeTree']> extends infer R
    ? R extends { fullPath: infer FP extends string }
      ? FP extends `/${string}` | '/'
        ? WithoutTrailingSlash<FP>
        : never
      : never
    : never

export type SidebarLink = {
  label: string
  to: AppRoute
}

export type SidebarItem = {
  label: string
  icon: FC<IconProps & RefAttributes<SVGSVGElement>>
  to?: AppRoute
  links?: SidebarLink[]
  initiallyOpened?: boolean
}

export type SidebarGroup = {
  title?: string
  items: SidebarItem[]
}
