import { getCurrentAppName } from '../libs/utils'

const ImageProxy = new Proxy(Image, {
  construct (Target, args): HTMLImageElement {
    const elementImage = new Target(...args)
    elementImage.__MICRO_APP_NAME__ = getCurrentAppName()
    return elementImage
  },
})

export default ImageProxy
