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

// 循环内嵌时子应用卸载后辈应用
export function listenUmountAppInline (): void {
  if (window.__MICRO_APP_ENVIRONMENT__) {
    window.addEventListener('unmount', unmountAppInline, false)
  }
}

// 解除监听
export function replaseUnmountAppInline (): void {
  if (window.__MICRO_APP_ENVIRONMENT__) {
    window.removeEventListener('unmount', unmountAppInline, false)
  }
}
