import { listenUmountAppInline, replaseUnmountAppInline } from '../../libs/additional'
import CreateApp, { appInstanceMap } from '../../create_app'

describe('test additional', () => {
  test('unmount app loop build-in', () => {
    const con1 = document.createElement('micro-app')
    // @ts-ignore
    con1.disconnectedCallback = jest.fn
    con1.attachShadow({ mode: 'open' })
    const app1 = {
      name: 'test-app1',
      url: 'http://localhost:3000/',
      scopecss: true,
      useSandbox: true,
      container: con1.shadowRoot,
    }
    appInstanceMap.set('test-app1', app1 as CreateApp)

    const con2 = document.createElement('micro-app')
    // @ts-ignore
    con2.disconnectedCallback = jest.fn
    const app2 = {
      name: 'test-app2',
      url: 'http://localhost:3000/',
      scopecss: true,
      useSandbox: true,
      container: con2,
    }
    appInstanceMap.set('test-app2', app2 as CreateApp)

    const app3 = {
      name: 'test-app3',
      url: 'http://localhost:3000/',
      scopecss: true,
      useSandbox: true,
    }
    appInstanceMap.set('test-app3', app3 as CreateApp)

    expect(appInstanceMap.size).toBe(3)

    listenUmountAppInline()
    replaseUnmountAppInline()

    window.__MICRO_APP_ENVIRONMENT__ = true
    listenUmountAppInline()
    const event = new CustomEvent('unmount')
    window.dispatchEvent(event)

    expect(appInstanceMap.size).toBe(0)

    replaseUnmountAppInline()

    window.__MICRO_APP_ENVIRONMENT__ = false
  })
})
