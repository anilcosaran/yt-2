/**
 * E1-J: the pixel size of an image the editor only knows by URL (an avatar look whose Storage record carries no
 * width/height). The compiler fits an image inside the canvas by its natural size, so a tool that positions it (the
 * Avatar "right third", a background that covers the canvas) needs that size. Null when the image cannot be read in time:
 * the layer is then placed fitted and centred, never from a guessed size.
 */

export type NaturalSize = { width: number; height: number }

type ImageLike = {
  onload: (() => void) | null
  onerror: (() => void) | null
  naturalWidth: number
  naturalHeight: number
  src: string
}

export function loadImageSize(
  url: string,
  options: { timeoutMs?: number; createImage?: () => ImageLike; setTimeoutFn?: typeof setTimeout; clearTimeoutFn?: typeof clearTimeout } = {},
): Promise<NaturalSize | null> {
  const createImage = options.createImage ?? (() => new Image() as unknown as ImageLike)
  const setTimer = options.setTimeoutFn ?? setTimeout
  const clearTimer = options.clearTimeoutFn ?? clearTimeout
  return new Promise((resolve) => {
    const image = createImage()
    const done = (size: NaturalSize | null) => {
      clearTimer(timer)
      image.onload = null
      image.onerror = null
      resolve(size)
    }
    const timer = setTimer(() => done(null), options.timeoutMs ?? 8000)
    image.onload = () => done(image.naturalWidth > 0 && image.naturalHeight > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : null)
    image.onerror = () => done(null)
    image.src = url
  })
}
