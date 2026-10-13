'use client'

/** Reset then open a file input so cancel → click again still shows the OS picker. */
export function openFileInput(input: HTMLInputElement | null | undefined) {
  if (!input) return
  input.value = ''
  input.click()
}

export function bindFileInputCancel(input: HTMLInputElement | null | undefined, onCancel: () => void) {
  if (!input) return () => undefined
  const handleCancel = () => {
    input.value = ''
    onCancel()
  }
  input.addEventListener('cancel', handleCancel)
  return () => input.removeEventListener('cancel', handleCancel)
}
