/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from './common/initial'
import { appInstanceMap } from '../create_app'
import { appStatus } from '../constants'
import microApp from '..'

describe('create_app', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.create_app)
    microApp.start()
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 在子应用加载完静态资源之前就卸载，然后重新渲染
  test('unmount app before end of loading resource and remount', async () => {
    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common/`)

    let createCount = 0
    await new Promise((reslove) => {
      // 元素被插入到文档中，此时已经开始请求资源
      // created 将会被执行两次
      microappElement1.addEventListener('created', () => {
        createCount++
        expect(appInstanceMap.size).toBe(1)
        if (createCount === 1) {
          expect(appInstanceMap.get('test-app1')!.getAppStatus()).toBe(appStatus.LOADING_SOURCE_CODE)
        } else {
          // 二次渲染时会异步执行mount，所以此时仍然是UNMOUNT
          expect(appInstanceMap.get('test-app1')!.getAppStatus()).toBe(appStatus.UNMOUNT)
        }
        reslove(true)
      }, false)

      appCon.appendChild(microappElement1)
    })

    await new Promise((reslove) => {
      microappElement1.addEventListener('unmount', () => {
        const app = appInstanceMap.get('test-app1')!
        expect(app.getAppStatus()).toBe(appStatus.UNMOUNT)
        // 因为应用还没渲染就卸载，所以active始终为false
        // @ts-ignore
        expect(app.sandBox!.active).toBeFalsy()
        Promise.resolve().then(() => {
          expect(app.container).toBeNull()
          reslove(true)
        })
      }, false)
      appCon.removeChild(microappElement1)
    })

    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        expect(createCount).toBe(2)
      }, false)
      appCon.appendChild(microappElement1)
      reslove(true)
    })
  })

  // 关闭沙箱
  test('disableSandbox in this app', async () => {
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.create_app}/dynamic/`)
    microappElement2.setAttribute('disableSandbox', 'true')

    appCon.appendChild(microappElement2)
    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        expect(appInstanceMap.get('test-app2')!.useSandbox).toBeFalsy()
        reslove(true)
      }, false)
    })

    appCon.removeChild(microappElement2)
  })

  // 组件卸载后获取html失败
  test('unmount app before fetch html failed', async () => {
    const microappElement3 = document.createElement('micro-app')
    microappElement3.setAttribute('name', 'test-app3')
    microappElement3.setAttribute('url', 'http://www.not-exist.com/')

    const errorHandle = jest.fn()
    microappElement3.addEventListener('error', errorHandle)

    appCon.appendChild(microappElement3)
    appCon.removeChild(microappElement3)

    await new Promise((reslove) => {
      setTimeout(() => {
        expect(errorHandle).not.toBeCalled()
        reslove(true)
      }, 100)
    })
  })

  // 发送mounted事件时app已被卸载
  test('coverage branch of dispatch mounted event when app has unmounted', async () => {
    const microappElement4 = document.createElement('micro-app')
    microappElement4.setAttribute('name', 'test-app4')
    microappElement4.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common/`)

    appCon.appendChild(microappElement4)

    const mountedHandler1 = jest.fn()
    microappElement4.addEventListener('mounted', mountedHandler1)

    function unmountTestApp4 () {
      appCon.removeChild(microappElement4)
      window.removeEventListener('unmount-me', unmountTestApp4)
    }
    window.addEventListener('unmount-me', unmountTestApp4)

    // 子应用通过数据通信异步通知基座卸载自己，但异步优先于mounted执行
    const microappElement5 = document.createElement('micro-app')
    microappElement5.setAttribute('name', 'test-app5')
    microappElement5.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common/`)

    appCon.appendChild(microappElement5)

    const mountedHandler2 = jest.fn()
    microappElement5.addEventListener('mounted', mountedHandler2)

    function unmountTestApp5 (data: Record<string, unknown>) {
      if (data.unmountMeAsync === true) {
        appCon.removeChild(microappElement5)
        microApp.removeDataListener('test-app5', unmountTestApp5)
      }
    }
    microApp.addDataListener('test-app5', unmountTestApp5)

    await new Promise((reslove) => {
      setTimeout(() => {
        // mounted 钩子不执行
        expect(mountedHandler1).not.toBeCalled()
        expect(mountedHandler2).not.toBeCalled()
        reslove(true)
      }, 200)
    })
  })

  // 非沙箱环境的umd，在destory卸载时，注册在window的函数应该删除
  test('render umd app with disablesandbox & destory', async () => {
    const microAppElement6 = document.createElement('micro-app')
    microAppElement6.setAttribute('name', 'test-app6')
    microAppElement6.setAttribute('library', 'umd-app1') // 自定义umd名称
    microAppElement6.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd1`)
    microAppElement6.setAttribute('disablesandbox', 'true')
    microAppElement6.setAttribute('destory', 'true')

    appCon.appendChild(microAppElement6)

    await new Promise((reslove) => {
      microAppElement6.addEventListener('mounted', () => {
        // @ts-ignore
        expect(window['umd-app1']).not.toBeUndefined()
        appCon.removeChild(microAppElement6)
        // @ts-ignore
        expect(window['umd-app1']).toBeUndefined()
        reslove(true)
      })
    })
  })

  // 分支覆盖 -- 返回 promise 的 mount 和 unmount 函数
  test('promised mount & unmount', async () => {
    const microAppElement7 = document.createElement('micro-app')
    microAppElement7.setAttribute('name', 'test-app7')
    microAppElement7.setAttribute('library', 'umd-app3') // 自定义umd名称
    microAppElement7.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd3`)

    appCon.appendChild(microAppElement7)

    await new Promise((reslove) => {
      microAppElement7.addEventListener('mounted', () => {
        microAppElement7.addEventListener('unmount', () => {
          reslove(true)
        })
        appCon.removeChild(microAppElement7)
      })
    })

    // 再次渲染 -- 分支覆盖
    const microAppElement8 = document.createElement('micro-app')
    microAppElement8.setAttribute('name', 'test-app7')
    microAppElement8.setAttribute('library', 'umd-app3') // 自定义umd名称
    microAppElement8.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd3`)

    appCon.appendChild(microAppElement8)

    await new Promise((reslove) => {
      microAppElement8.addEventListener('mounted', () => {
        reslove(true)
      })
    })
  })

  // 分支覆盖 -- 抛出错误的 mount 和 unmount 函数
  test('throw error mount & unmount', async () => {
    const microAppElement9 = document.createElement('micro-app')
    microAppElement9.setAttribute('name', 'test-app9')
    microAppElement9.setAttribute('library', 'umd-app3') // 自定义umd名称
    microAppElement9.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd3`)

    // @ts-ignore
    window.specialUmdMode = 'error-hook'
    appCon.appendChild(microAppElement9)

    await new Promise((reslove) => {
      microAppElement9.addEventListener('mounted', () => {
        // 渲染时打印错误日志
        expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app9: an error occurred in the mount function \n', expect.any(Error))

        appCon.removeChild(microAppElement9)

        // 卸载时打印错误日志
        expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app9: an error occurred in the unmount function \n', expect.any(Error))

        reslove(true)
      })
    })

    const microAppElement10 = document.createElement('micro-app')
    microAppElement10.setAttribute('name', 'test-app9')
    microAppElement10.setAttribute('library', 'umd-app3') // 自定义umd名称
    microAppElement10.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd3`)

    appCon.appendChild(microAppElement10)

    await new Promise((reslove) => {
      microAppElement10.addEventListener('mounted', () => {
        // 再次渲染时打印错误日志
        expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app9: an error occurred in the mount function \n', expect.any(Error))
        reslove(true)
      })
    })

    // @ts-ignore
    delete window.specialUmdMode
  })

  // 分支覆盖 -- 抛出错误promise 的 mount 和 unmount 函数
  test('throw error promise mount & unmount', async () => {
    const microAppElement11 = document.createElement('micro-app')
    microAppElement11.setAttribute('name', 'test-app11')
    microAppElement11.setAttribute('library', 'umd-app3') // 自定义umd名称
    microAppElement11.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd3`)

    // @ts-ignore
    window.specialUmdMode = 'error-promise-hook'
    appCon.appendChild(microAppElement11)

    await new Promise((reslove) => {
      // promise.reject 会触发error事件，不会触发mounted事件
      microAppElement11.addEventListener('error', () => {
        // promise.reject 会正常触发unmount事件
        microAppElement11.addEventListener('unmount', () => {
          reslove(true)
        })

        appCon.removeChild(microAppElement11)
      })
    })

    // @ts-ignore
    delete window.specialUmdMode
  })
})
