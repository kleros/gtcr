/*
 * Atlas takes list logos as PNG only: its Curate "logo" role allows
 * image/png and "image/svg", and browsers type SVG files image/svg+xml, so
 * an SVG, a JPEG or a WebP would be refused after the upload. Logos are
 * redrawn as PNG in the browser first: raster images at their own size (at
 * most 1024px on the long side), vector images at 512px.
 */

const RASTER_MAX_SIDE = 1024
const VECTOR_SIDE = 512

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () =>
      reject(new Error('This image could not be read.')),
    )
    image.src = url
  })

/** The file itself if it is a PNG, else the same picture as a PNG file. */
export const toPng = async (file: File): Promise<File> => {
  if (file.type === 'image/png') return file
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const vector = file.type === 'image/svg+xml'
    // An SVG without a size reports 0 (or a 300 by 150 default): give it a
    // square box and let drawImage fit the picture's own proportions.
    const width = image.naturalWidth || VECTOR_SIDE
    const height = image.naturalHeight || VECTOR_SIDE
    const scale = vector
      ? VECTOR_SIDE / Math.max(width, height)
      : Math.min(1, RASTER_MAX_SIDE / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This image could not be converted.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) throw new Error('This image could not be converted.')
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'logo'}.png`
    return new File([blob], name, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
