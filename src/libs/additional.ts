import { appInstanceMap } from '../create_app'
import { elementInstanceMap } from '../micro_app_element'
import { releasePatches } from '../source/patch'
import { getRootContainer } from '../libs/utils'

function unmountNestedApp (): void {
  releaseUnmountOfNestedApp()

  appInstanceMap.forEach(app => {
    // @ts-ignore
    app.container && getRootContainer(app.container).disconnectedCallback()
  })

  !window.__MICRO_APP_UMD_MODE__ && appInstanceMap.clear()

  if (elementInstanceMap.size) {
    elementInstanceMap.clear()
    releasePatches()
  }
}

// if micro-app run in micro application, delete all next generation application when unmount event received
export function listenUmountOfNestedApp (): void {
  if (window.__MICRO_APP_ENVIRONMENT__) {
    window.addEventListener('unmount', unmountNestedApp, false)
  }
}

// release listener
export function releaseUnmountOfNestedApp (): void {
  if (window.__MICRO_APP_ENVIRONMENT__) {
    window.removeEventListener('unmount', unmountNestedApp, false)
  }
}
