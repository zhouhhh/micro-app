/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from '../common'
import { appInstanceMap } from '../../src/create_app'
import microApp from '../../src'

describe('sandbox effect2', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.effect2)
    appCon = document.querySelector('#app-container')!

    microApp.start()
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // document.onclick 测试
  test('onclick can only be rewritten once', async () => {
    Object.defineProperty(document, 'onclick', {
      configurable: false,
      enumerable: true,
      value: null,
    })

    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.effect2}/common/`)

    appCon.appendChild(microappElement1)

    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(1)
        reslove(true)
      }, false)
    })
  })
})
