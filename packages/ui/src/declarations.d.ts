declare module '*.css' {}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '@fontsource-variable/*' {}
