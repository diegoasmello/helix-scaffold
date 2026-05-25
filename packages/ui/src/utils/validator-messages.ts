export const msg = {
  required: 'Required',
  maxLength: (max: number) => `Max ${max} characters`,
  minLength: (min: number) => `Min ${min} characters`,
  minFiles: (min: number) =>
    min === 1 ? 'At least one file is required' : `At least ${min} files are required`,
  email: 'Invalid email address',
}
