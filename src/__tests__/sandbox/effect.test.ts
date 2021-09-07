/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from '../common'
import { appInstanceMap } from '../../create_app'
import microApp from '../..'
// import { defer } from '../../src/libs/utils'

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
    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.effect}/common/`)

    document.onclick = null

    appCon.appendChild(microappElement1)

    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(1)
        // 基座应用document.onclick赋值/取值
        const baseDomOnclick = jest.fn()
        document.onclick = baseDomOnclick
        expect(document.onclick).toBe(baseDomOnclick)

        // 基座应用 document 通过addEventListener监听/卸载
        document.addEventListener('click', baseDomOnclick, false)
        document.removeEventListener('click', baseDomOnclick, false)
        reslove(true)
      }, false)
    })
  })

  // 测试window event一些特殊分支
  test('special branch coverage of window event', async () => {
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.effect}/ssr-render/`)

    appCon.appendChild(microappElement2)

    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(2)
        reslove(true)
      }, false)
    })
  })

  //
  test('coverage branch of umd effect snapshot', async () => {
    const microAppElement3 = document.createElement('micro-app')
    microAppElement3.setAttribute('name', 'test-app3')
    microAppElement3.setAttribute('library', 'umd-app2') // 自定义umd名称
    microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.effect}/umd2`)

    let commonReslove: CallableFunction
    function firstMountHandler () {
      microAppElement3.removeEventListener('mounted', firstMountHandler)
      appCon.removeChild(microAppElement3)
      commonReslove(true)
    }

    microAppElement3.addEventListener('mounted', firstMountHandler)

    await new Promise((reslove) => {
      commonReslove = reslove
      appCon.appendChild(microAppElement3)
    })

    await new Promise((reslove) => {
      microAppElement3.addEventListener('mounted', () => {
        reslove(true)
      })
      // 再次渲染
      appCon.appendChild(microAppElement3)
    })
  })
})
