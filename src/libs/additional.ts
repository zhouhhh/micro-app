import { appInstanceMap } from '../create_app'

function unmountAppInline (): void {
  appInstanceMap.forEach(app => {
    let element = app.container
    if (element) {
      if (element instanceof ShadowRoot) {
        element = element.host as HTMLElement
      }
      // @ts-ignore
      element.disconnectedCallback()
    }
  })
  appInstanceMap.clear()
}

// if micro-app run in micro application, delete all next generation application when unmount event received
export function listenUmountAppInline (): void {
  if (window.__MICRO_APP_ENVIRONMENT__) {
    window.addEventListener('unmount', unmountAppInline, false)
  }
}

// release listener
export function replaseUnmountAppInline (): void {
  if (window.__MICRO_APP_ENVIRONMENT__) {
    window.removeEventListener('unmount', unmountAppInline, false)
  }
}
