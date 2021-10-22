/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import { appInstanceMap } from '../../create_app'
import { globalLinks } from '../../source/links'
import microApp from '../..'

describe('source links', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.source_links)
    microApp.start({
      // 自定义fetch
      fetch (url: string, options: Record<string, unknown>) {
        return fetch(url, options).then((res) => {
          return res.text()
        })
      }
    })
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 创建一个动态的无效的link标签
  test('append a link with error herf', async () => {
    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic/`)

    appCon.appendChild(microappElement1)
    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        setAppName('test-app1')
        // 动态创建link
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'stylesheet')
        dynamicLink.setAttribute('href', 'http://www.micro-app-test.com/not-exist.css')
        document.head.appendChild(dynamicLink)
        dynamicLink.onerror = function () {
          expect(console.error).toBeCalledWith('[micro-app]', expect.any(Error))
        }
        reslove(true)
      }, false)
    })
  })

  // 创建一个动态的非常规link
  test('append an unusual link', async () => {
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic/`)

    appCon.appendChild(microappElement2)
    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        setAppName('test-app2')
        // 动态创建link
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'preload')
        dynamicLink.setAttribute('href', './manifest.js')
        dynamicLink.setAttribute('id', 'dynamic-link-preload')
        document.head.appendChild(dynamicLink)

        expect(document.getElementById('dynamic-link-preload')?.getAttribute('href')).toBe(`http://127.0.0.1:${ports.source_links}/dynamic/manifest.js`)
        reslove(true)
      }, false)
    })
  })

  // html中加载错误的css资源
  test('load css error in html', async () => {
    const microappElement3 = document.createElement('micro-app')
    microappElement3.setAttribute('name', 'test-app3')
    microappElement3.setAttribute('url', `http://127.0.0.1:${ports.source_links}/special-html/notexist-css.html`)

    appCon.appendChild(microappElement3)
    await new Promise((reslove) => {
      microappElement3.addEventListener('mounted', () => {
        expect(console.error).toBeCalled()
        reslove(true)
      }, false)
    })
  }, 10000)

  // 从自身缓存/全局缓存中获取css资源
  test('get css code from cache', async () => {
    const microappElement4 = document.createElement('micro-app')
    microappElement4.setAttribute('name', 'test-app4')
    microappElement4.setAttribute('url', `http://127.0.0.1:${ports.source_links}/element-config`)

    appCon.appendChild(microappElement4)
    await new Promise((reslove) => {
      microappElement4.addEventListener('mounted', () => {
        expect(globalLinks.size).toBe(1)
        reslove(true)
      }, false)
    })

    const microappElement5 = document.createElement('micro-app')
    microappElement5.setAttribute('name', 'test-app5')
    microappElement5.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic`)

    appCon.appendChild(microappElement5)
    await new Promise((reslove) => {
      microappElement5.addEventListener('mounted', () => {
        setAppName('test-app5')

        // 从全局缓存中获取css文件内容
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'stylesheet')
        dynamicLink.setAttribute('href', '/element-config/link1.css')
        document.head.appendChild(dynamicLink)
        // 同步从全局缓存中获取到代码
        const app = appInstanceMap.get('test-app5')!
        expect(app.source.links.get(`http://127.0.0.1:${ports.source_links}/element-config/link1.css`)?.code?.length).toBeGreaterThan(1)

        // 再次创建相同文件，则从自身app缓存中获取文件
        const dynamicLink2 = document.createElement('link')
        dynamicLink2.setAttribute('rel', 'stylesheet')
        dynamicLink2.setAttribute('href', '/element-config/link1.css')
        document.head.appendChild(dynamicLink2)

        reslove(true)
      }, false)
    })
  })

  // 测试分支覆盖 html自带css从全局缓存取值&创建新的动态全局css缓存
  test('coverage of static html global & dynamic global css', async () => {
    const microappElement6 = document.createElement('micro-app')
    microappElement6.setAttribute('name', 'test-app6')
    microappElement6.setAttribute('url', `http://127.0.0.1:${ports.source_links}/common`)

    appCon.appendChild(microappElement6)
    await new Promise((reslove) => {
      microappElement6.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })

    const microappElement7 = document.createElement('micro-app')
    microappElement7.setAttribute('name', 'test-app7')
    microappElement7.setAttribute('url', `http://127.0.0.1:${ports.source_links}/element-config`)

    appCon.appendChild(microappElement7)
    await new Promise((reslove) => {
      microappElement7.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })

    const microappElement8 = document.createElement('micro-app')
    microappElement8.setAttribute('name', 'test-app8')
    microappElement8.setAttribute('url', `http://127.0.0.1:${ports.source_links}/dynamic`)

    appCon.appendChild(microappElement8)
    await new Promise((reslove) => {
      microappElement8.addEventListener('mounted', () => {
        setAppName('test-app8')

        // 动态创建全局缓存文件
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('rel', 'stylesheet')
        dynamicLink.setAttribute('href', './link1.css')
        dynamicLink.setAttribute('global', 'true')
        document.head.appendChild(dynamicLink)
        reslove(true)
      }, false)
    })
  })
})
