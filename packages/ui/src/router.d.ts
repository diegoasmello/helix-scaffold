export type BreadcrumbItem = { label: string; to?: string }
export type BreadcrumbDef =
  | BreadcrumbItem
  | ((loaderData: unknown) => BreadcrumbItem)

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    breadcrumbs?: BreadcrumbDef[]
  }
}
