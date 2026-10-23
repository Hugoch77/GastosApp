/** Descarga un texto como archivo en el navegador. */
export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType = 'application/json',
): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
