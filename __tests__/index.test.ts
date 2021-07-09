/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from './common'
import microApp, { preFetch, removeDomScope, version, pureCreateElement } from '../src'
import { appInstanceMap } from '../src/create_app'
import { getCurrentAppName, defer } from '../src/libs/utils'

describe('main process', () => {
  // 根容器
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.index)
    appCon = document.querySelector('#app-container')!
    console.log(version, pureCreateElement('div'))

    microApp.start({
      tagName: 'micro-app',
      // shadowDOM: true,
      // inline: true,
      // destory: true,
      // disableScopecss: true,
      // disableSandbox: true,
      // macro: true,
      lifeCycles: {
        // created () {
        //   console.log('created 全局监听')
        // },
        // beforemount () {
        //   console.log('beforemount 全局监听')
        // },
        mounted (e: CustomEvent) {
          console.log('mounted 全局监听', e.detail.name)
        },
        // unmount () {
        //   console.log('unmount 全局监听')
        // },
        // error () {
        //   console.log('error 全局监听')
        // }
      },
      plugins: {
        // global: [{
        //   scopeProperties: ['1', '2'],
        //   escapeProperties: ['a', 'b'],
        //   options: { a: 1 },
        //   loader (code, _url, _options) {
        //     console.log('全局插件', _url)
        //     return code
        //   }
        // }],
        modules: {
          test1: [{
            scopeProperties: ['3', '4'],
            escapeProperties: ['c', 'd'],
            loader (code, _url) {
              // console.log('test1插件', _url)
              return code
            }
          }],
          test2: [{
            scopeProperties: ['5', '6'],
            escapeProperties: ['e', 'f'],
            loader (code, _url) {
              // console.log('test2插件', _url)
              return code
            }
          }]
        }
      },
      preFetchApps: function () {
        return [
          {
            name: 'test-app5',
            url: `http://127.0.0.1:${ports.index}/ssr-render`,
            disableScopecss: true,
            disableSandbox: true,
            macro: true,
          },
          {
            name: 'app-test-error',
            url: '',
          }
        ]
      }
    })

    preFetch([{
      name: 'test-app3',
      url: `http://127.0.0.1:${ports.index}/common`,
      // disableScopecss: xx,
      // disableSandbox: xx,
      // macro: xx,
      shadowDOM: true,
    }])
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 预加载的应用数量
  const prefetchAppNum = 2

  /**
   * name: test-app1
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app3'},
   * ]
   */
  test('main process of micro-app', async () => {
    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.index}/common`)
    microappElement1.setAttribute('inline', 'true')

    appCon.appendChild(microappElement1)

    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(prefetchAppNum + 1)
        reslove(true)
      }, false)
    })

    await new Promise((reslove) => {
      microappElement1.addEventListener('unmount', () => {
        defer(() => {
          expect(appInstanceMap.size).toBe(prefetchAppNum + 1)
          reslove(true)
        })
      }, false)

      appCon.removeChild(microappElement1)
    })

    removeDomScope()
  })

  /**
   * name: test-app2
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app3'},
   *  {name: 'test-app1'},
   * ]
   */
  test('app that stay active all the time', async () => {
    expect(getCurrentAppName()).toBeNull()
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.index}/ssr-render`)

    appCon.appendChild(microappElement2)

    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(prefetchAppNum + 2)
        reslove(true)
      }, false)
    })
  })

  /**
   * name: test-app3
   * 预加载: true
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app3'},
   *  {name: 'test-app1'},
   *  {name: 'test-app2'},
   * ]
   */
  test('render an unstable app with special attribute', async () => {
    const microappElement3 = document.createElement('micro-app')
    expect(microappElement3.data).toBeNull()
    // @ts-ignore
    microappElement3.setAttribute('data', { count: 'count-1' })
    expect(microappElement3.data.count).toBe('count-1')
    microappElement3.setAttribute('name', 'test-app3')
    microappElement3.setAttribute('url', `http://127.0.0.1:${ports.index}/common`)
    microappElement3.setAttribute('destory', 'true')
    microappElement3.setAttribute('shadowDOM', 'true')
    microappElement3.setAttribute('inline', 'true')
    // @ts-ignore
    microappElement3.setAttribute('data', { count: 'count-2' })
    expect(microappElement3.data.count).toBe('count-2')
    let mountCount = 0

    appCon.appendChild(microappElement3)

    await new Promise((reslove) => {
      microappElement3.addEventListener('mounted', () => {
        const microElem = document.querySelectorAll('micro-app')[1]
        expect(microElem.shadowRoot instanceof ShadowRoot).toBeTruthy()

        mountCount++
        if (mountCount === 1) {
          expect(appInstanceMap.size).toBe(prefetchAppNum + 2)
          // 等懒加载资源执行完
          setTimeout(() => {
            microappElement3.setAttribute('name', 'test-app1')
            microappElement3.setAttribute('url', `http://127.0.0.1:${ports.index}/ssr-render`)
          }, 500)
        } else {
          expect(appInstanceMap.size).toBe(prefetchAppNum + 1)
          reslove(true)
        }
      }, false)
    })

    await new Promise((reslove) => {
      microappElement3.addEventListener('unmount', () => {
        defer(() => {
          expect(appInstanceMap.size).toBe(prefetchAppNum)
          reslove(true)
        })
      }, false)

      appCon.removeChild(microappElement3)
    })
  })

  /**
   * name: test-app4
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app2'},
   * ]
   */
  test('failed to fetch html', async () => {
    const microAppElement4 = document.createElement('micro-app')
    microAppElement4.setAttribute('name', 'test-app4')
    microAppElement4.setAttribute('url', 'http://not-exist.com/xx')

    await new Promise((reslove) => {
      microAppElement4.addEventListener('error', () => {
        expect(console.error).toHaveBeenCalledWith('[micro-app] Failed to fetch data from http://not-exist.com/xx/, micro-app stop rendering', expect.any(Error))
        reslove(true)
      }, false)
      appCon.appendChild(microAppElement4)
    })
  })

  /**
   * 卸载所有应用
   * 卸载前：appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app2'},
   * ]
   */
  test('clear all apps', () => {
    appCon.innerHTML = ''
    // test-app5为预加载，test-app2不强制删除，所以卸载后还有2个应用
    expect(appInstanceMap.size).toBe(2)
  })
})
