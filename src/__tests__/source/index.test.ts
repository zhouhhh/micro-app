/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from '../common/initial'
import { appInstanceMap } from '../../create_app'
import microApp from '../..'

declare global {
  interface HTMLElement {
    src: string
    href: string
  }
}

describe('source index', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.source_index)
    microApp.start({
      // globalAssets 测试分支覆盖
      globalAssets: {
        js: 'xx' as any,
        css: 'xx' as any,
      }
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 带有exclude属性的dom需要被忽略
  test('exclude dom should be ignore', async () => {
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.source_index}/element-config/`)
    microappElement2.setAttribute('disableScopecss', 'true')

    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        expect(document.getElementById('app4-style-exclude')).toBeNull()
        expect(document.getElementById('app4-link-exclude')).toBeNull()
        expect(document.getElementById('app4-script-exclude')).toBeNull()
        expect(document.getElementById('app4-link-include')).toBeNull()

        const app = appInstanceMap.get('test-app2')!
        expect(app.source.links.size).toBe(3)
        expect(app.source.scripts.size).toBe(3)
        reslove(true)
      }, false)

      appCon.appendChild(microappElement2)
    })
  })

  // 支持text类型入口文件
  test('support text file as index', async () => {
    const microappElement3 = document.createElement('micro-app')
    microappElement3.setAttribute('name', 'test-app3')
    microappElement3.setAttribute('url', `http://127.0.0.1:${ports.source_index}/element-config/index.txt`)
    await new Promise((reslove) => {
      microappElement3.addEventListener('mounted', () => {
        const app = appInstanceMap.get('test-app3')!
        expect(app.source.links.size).toBe(1)
        expect(app.source.scripts.size).toBe(0)
        reslove(true)
      }, false)

      appCon.appendChild(microappElement3)
    })
  })

  // html 没有head或body标签则报错
  test('no head or no body element in html', async () => {
    const microappElement4 = document.createElement('micro-app')
    microappElement4.setAttribute('name', 'test-app4')
    microappElement4.setAttribute('url', `http://127.0.0.1:${ports.source_index}/special-html/nohead.html`)

    appCon.appendChild(microappElement4)
    const noheadErrorHandle = jest.fn()
    microappElement4.addEventListener('error', noheadErrorHandle)

    await new Promise((reslove) => {
      setTimeout(() => {
        reslove(true)
      }, 200)
    })

    expect(console.error).toBeCalledWith('[micro-app] app test-app4: element head is missing')
    expect(noheadErrorHandle).toBeCalledWith(expect.any(CustomEvent))

    const microappElement5 = document.createElement('micro-app')
    microappElement5.setAttribute('name', 'test-app5')
    microappElement5.setAttribute('url', `http://127.0.0.1:${ports.source_index}/special-html/nobody.html`)

    appCon.appendChild(microappElement5)
    const nobodyErrorHandle = jest.fn()
    microappElement5.addEventListener('error', nobodyErrorHandle)

    await new Promise((reslove) => {
      setTimeout(() => {
        reslove(true)
      }, 200)
    })

    expect(console.error).toHaveBeenLastCalledWith('[micro-app] app test-app5: element body is missing')
    expect(nobodyErrorHandle).toBeCalledWith(expect.any(CustomEvent))
  })

  // 补全html中的img, 但iframe、a不做处理
  test('completion path of img/iframe/a in html', async () => {
    const microappElement6 = document.createElement('micro-app')
    microappElement6.setAttribute('name', 'test-app6')
    microappElement6.setAttribute('url', `http://127.0.0.1:${ports.source_index}/ssr-render/`)

    appCon.appendChild(microappElement6)

    await new Promise((reslove) => {
      microappElement6.addEventListener('mounted', () => {
        expect(document.getElementById('app2-img1')?.getAttribute('src')).toBe(`http://127.0.0.1:${ports.source_index}/path-a/img.jpg`)
        expect(document.getElementById('app2-iframe1')?.getAttribute('src')).toBe('/path-b/')
        expect(document.getElementById('app2-a1')?.getAttribute('href')).toBe('/abc/')
        reslove(true)
      }, false)
    })
  })

  // 返回一个空的html
  test('test empty html', async () => {
    const microappElement7 = document.createElement('micro-app')
    microappElement7.setAttribute('name', 'test-app7')
    microappElement7.setAttribute('url', `http://127.0.0.1:${ports.source_index}/special-html/empty.html`)

    appCon.appendChild(microappElement7)

    await new Promise((reslove) => {
      setTimeout(() => {
        expect(console.error).toHaveBeenLastCalledWith('[micro-app] app test-app7: html is empty, please check in detail')
        reslove(true)
      }, 100)
    })
  })
})
