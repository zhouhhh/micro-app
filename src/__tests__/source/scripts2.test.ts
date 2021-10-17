/* eslint-disable promise/param-names */
import { rawDocumentCreateElement, rawSetAttribute } from './support_module'
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import microApp from '../..'

describe('source scripts2', () => {
  let appCon: Element
  beforeAll(() => {
    // URL.createObjectURL is undefined in jest env
    global.URL.createObjectURL = jest.fn()
    commonStartEffect(ports.source_scripts2)
    microApp.start({
      plugins: {}
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    Document.prototype.createElement = rawDocumentCreateElement
    Element.prototype.setAttribute = rawSetAttribute
    return releaseAllEffect()
  })

  // 支持module的环境
  test('support module envrionment', async () => {
    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.source_scripts2}/common/`)

    appCon.appendChild(microappElement1)
    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        setAppName('test-app1')
        // 动态创建script，noModulejs不会被执行
        const dynamicScript = document.createElement('script')
        dynamicScript.setAttribute('src', '/common/script2.js')
        dynamicScript.setAttribute('noModule', 'true')
        document.head.appendChild(dynamicScript)

        // 模拟环境下，html自带nomodule不会触发setAttribute，所以会执行，此处为特殊情况
        expect(console.warn).toBeCalledWith('nomodule')

        // html自带module为异步执行，所以加上setTimeout
        setTimeout(() => {
          expect(console.warn).toBeCalledWith('module')
          reslove(true)
        }, 100)
      }, false)
    })
  })

  // 在inline模式下开启module
  test('use module in inline mode', async () => {
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.source_scripts2}/dynamic/`)
    microappElement2.setAttribute('inline', 'true')
    microappElement2.setAttribute('disablesandbox', 'true')

    appCon.appendChild(microappElement2)
    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        setAppName('test-app2')

        const dynamicScript1 = document.createElement('script')
        dynamicScript1.setAttribute('type', 'module')
        dynamicScript1.textContent = 'console.warn("inline module")'
        document.head.appendChild(dynamicScript1)

        const dynamicScript2 = document.createElement('script')
        dynamicScript2.setAttribute('src', '/common/module.js')
        dynamicScript2.setAttribute('type', 'module')
        document.head.appendChild(dynamicScript2)

        // expect(console.warn).toBeCalledWith('inline module')
        reslove(true)
      }, false)
    })
  })
})
