/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import { appInstanceMap } from '../../create_app'
import { getCurrentAppName } from '../../libs/utils'
import microApp, { unmountAllApps } from '../..'

describe('sandbox effect', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.effect)
    appCon = document.querySelector('#app-container')!

    microApp.start({
      plugins: {}, // sandbox/index 分支覆盖
    })
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 测试document click一些特殊分支
  test('special branch coverage of document click', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.effect}/common/`)

    document.onclick = null

    appCon.appendChild(microAppElement1)

    await new Promise((resolve) => {
      microAppElement1.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(1)
        // 基座应用document.onclick赋值/取值
        const baseDomOnclick = jest.fn()
        document.onclick = baseDomOnclick
        expect(document.onclick).toBe(baseDomOnclick)

        // 基座应用 document 通过addEventListener监听/卸载
        document.addEventListener('click', baseDomOnclick, false)
        document.removeEventListener('click', baseDomOnclick, false)
        resolve(true)
      }, false)
    })
  })

  // 测试window event一些特殊分支
  test('special branch coverage of window event', async () => {
    const microAppElement2 = document.createElement('micro-app')
    microAppElement2.setAttribute('name', 'test-app2')
    microAppElement2.setAttribute('url', `http://127.0.0.1:${ports.effect}/ssr-render/`)

    appCon.appendChild(microAppElement2)

    await new Promise((resolve) => {
      microAppElement2.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(2)
        resolve(true)
      }, false)
    })
  })

  // effect snapshot 分支覆盖
  test('coverage branch of umd effect snapshot', async () => {
    const microAppElement3 = document.createElement('micro-app')
    microAppElement3.setAttribute('name', 'test-app3')
    microAppElement3.setAttribute('library', 'umd-app2') // 自定义umd名称
    microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.effect}/umd2`)

    let commonResolve: CallableFunction
    function firstMountHandler () {
      microAppElement3.removeEventListener('mounted', firstMountHandler)
      appCon.removeChild(microAppElement3)
      commonResolve(true)
    }

    microAppElement3.addEventListener('mounted', firstMountHandler)

    await new Promise((resolve) => {
      commonResolve = resolve
      appCon.appendChild(microAppElement3)
    })

    await new Promise((resolve) => {
      microAppElement3.addEventListener('mounted', () => {
        resolve(true)
      })
      // 再次渲染
      appCon.appendChild(microAppElement3)
    })
  })

  // 分支覆盖 -- umd模式下 document事件的 bound 函数
  test('coverage of bound function of document event in umd mode', async () => {
    const microAppElement4 = document.createElement('micro-app')
    microAppElement4.setAttribute('name', 'test-app4')
    microAppElement4.setAttribute('url', `http://127.0.0.1:${ports.effect}/umd1/`)

    appCon.appendChild(microAppElement4)

    await new Promise((resolve) => {
      microAppElement4.addEventListener('mounted', () => {
        setAppName('test-app4')
        const boundFunc1 = function func1 () {}
        const boundFunc2 = function func2 () {}
        const boundFunc3 = function func3 () {}

        const app = appInstanceMap.get('test-app4')!

        // scene1 - app not exist
        appInstanceMap.delete('test-app4')
        document.addEventListener('click', boundFunc1, false)
        document.removeEventListener('click', boundFunc1, false)

        // scene2 - app not umd mode
        app.umdMode = false
        appInstanceMap.set('test-app4', app)
        document.addEventListener('click', boundFunc2, false)
        document.removeEventListener('click', boundFunc2, false)

        // scene3 - app is umd mode, and listener is bound function
        app.umdMode = true
        document.addEventListener('click', boundFunc3, false)
        document.removeEventListener('click', boundFunc3, false)

        resolve(true)
      }, false)
    })
  })

  // 测试PC端temporarySolutionForDomScope
  test('test temporarySolutionForDomScope of mouseEvent', async () => {
    const microAppElement5 = document.createElement('micro-app')
    microAppElement5.setAttribute('name', 'test-app5')
    microAppElement5.setAttribute('url', `http://127.0.0.1:${ports.effect}/common/`)

    appCon.appendChild(microAppElement5)

    await new Promise((resolve) => {
      microAppElement5.addEventListener('mounted', () => {
        const topLevelElement = microAppElement5.querySelector('#top-level')

        // mousedown 事件
        const mousedownEvent = new CustomEvent('mousedown')
        // 分支覆盖之target为空
        window.dispatchEvent(mousedownEvent)
        expect(getCurrentAppName()).toBe(null)

        // 定义非micro-app元素的target
        Object.defineProperty(mousedownEvent, 'target', {
          get () {
            return microAppElement5.parentNode
          },
          configurable: true,
        })

        window.dispatchEvent(mousedownEvent)
        expect(getCurrentAppName()).toBe(null)

        // 定义micro-app范围内的元素为target
        Object.defineProperty(mousedownEvent, 'target', {
          get () {
            return topLevelElement
          },
          configurable: true,
        })
        window.dispatchEvent(mousedownEvent)
        expect(getCurrentAppName()).toBe('test-app5')

        // mouseup 事件
        const mouseupEvent = new CustomEvent('mouseup')
        window.dispatchEvent(mouseupEvent)

        setTimeout(() => {
          expect(getCurrentAppName()).toBe(null)
          // coverage branch
          window.dispatchEvent(mouseupEvent)
          resolve(true)
        }, 10)
      })
    })
  })

  // 测试移动端temporarySolutionForDomScope
  test('test temporarySolutionForDomScope of touchEvent', async () => {
    const microAppElement6 = document.createElement('micro-app')
    microAppElement6.setAttribute('name', 'test-app6')
    microAppElement6.setAttribute('url', `http://127.0.0.1:${ports.effect}/common/`)

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
      writable: true,
      configurable: true,
    })

    // 卸载所有应用
    await unmountAllApps({
      clearAliveState: true,
    })

    appCon.appendChild(microAppElement6)

    await new Promise((resolve) => {
      microAppElement6.addEventListener('mounted', () => {
        const topLevelElement = microAppElement6.querySelector('#top-level')

        // touchstart 事件
        const touchstartEvent = new CustomEvent('touchstart')
        // 分支覆盖之target为空
        window.dispatchEvent(touchstartEvent)
        expect(getCurrentAppName()).toBe(null)

        // 定义非micro-app元素的target
        Object.defineProperty(touchstartEvent, 'target', {
          get () {
            return microAppElement6.parentNode
          },
          configurable: true,
        })

        window.dispatchEvent(touchstartEvent)
        expect(getCurrentAppName()).toBe(null)

        // 定义micro-app范围内的元素为target
        Object.defineProperty(touchstartEvent, 'target', {
          get () {
            return topLevelElement
          },
          configurable: true,
        })
        window.dispatchEvent(touchstartEvent)
        expect(getCurrentAppName()).toBe('test-app6')

        // touchend 事件
        const touchendEvent = new CustomEvent('touchend')
        window.dispatchEvent(touchendEvent)

        setTimeout(() => {
          expect(getCurrentAppName()).toBe(null)
          // coverage branch
          window.dispatchEvent(touchendEvent)
          resolve(true)
        }, 10)
      })
    })
  })
})
