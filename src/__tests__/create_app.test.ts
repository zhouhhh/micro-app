/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from './common/initial'
import { appInstanceMap, unmountApp, unmountAllApps } from '../create_app'
import { appStates, keepAliveStates } from '../constants'
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
          expect(appInstanceMap.get('test-app1')!.getAppState()).toBe(appStates.LOADING_SOURCE_CODE)
        } else {
          // 二次渲染时会异步执行mount，所以此时仍然是UNMOUNT
          expect(appInstanceMap.get('test-app1')!.getAppState()).toBe(appStates.UNMOUNT)
        }
        reslove(true)
      }, false)

      appCon.appendChild(microappElement1)
    })

    await new Promise((reslove) => {
      microappElement1.addEventListener('unmount', () => {
        const app = appInstanceMap.get('test-app1')!
        expect(app.getAppState()).toBe(appStates.UNMOUNT)
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
      }, 200)
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

  // 非沙箱环境的umd，在destroy卸载时，注册在window的函数应该删除
  test('render umd app with disablesandbox & destroy', async () => {
    const microAppElement6 = document.createElement('micro-app')
    microAppElement6.setAttribute('name', 'test-app6')
    microAppElement6.setAttribute('library', 'umd-app1') // 自定义umd名称
    microAppElement6.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd1`)
    microAppElement6.setAttribute('disablesandbox', 'true')
    microAppElement6.setAttribute('destroy', 'true')

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

  // 测试 unmountApp 方法
  test('test unmountApp method', async () => {
    // 场景1: 常规卸载操作
    const microAppElement12 = document.createElement('micro-app')
    microAppElement12.setAttribute('name', 'test-app12')
    microAppElement12.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)

    appCon.appendChild(microAppElement12)

    await new Promise((reslove) => {
      microAppElement12.addEventListener('mounted', () => {
        unmountApp('test-app12').then(reslove)
      })
    })

    await new Promise((reslove) => {
      unmountApp('not-exist').then(() => {
        expect(console.warn).toHaveBeenCalledWith('[micro-app] app not-exist does not exist')
        reslove(true)
      })
    })

    // 场景2: 卸载已经卸载的应用
    const microAppElement13 = document.createElement('micro-app')
    microAppElement13.setAttribute('name', 'test-app13')
    microAppElement13.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)

    appCon.appendChild(microAppElement13)

    await new Promise((reslove) => {
      microAppElement13.addEventListener('mounted', () => {
        appCon.removeChild(microAppElement13)
      })

      // 应用已经卸载后执行unmountApp
      microAppElement13.addEventListener('unmount', () => {
        // 首次卸载不传 destroy，则直接返回，test-app13依然存在
        unmountApp('test-app13').then(() => {
          expect(appInstanceMap.has('test-app13')).toBeTruthy()
          // 第二次卸载设置destroy，应用被删除
          unmountApp('test-app13', {
            destroy: true,
          }).then(() => {
            expect(appInstanceMap.has('test-app13')).toBeFalsy()
            reslove(true)
          })
        })
      })
    })

    // 场景3: 卸载已经推入后台的keep-alive应用
    const microAppElement14 = document.createElement('micro-app')
    microAppElement14.setAttribute('name', 'test-app14')
    microAppElement14.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)
    microAppElement14.setAttribute('keep-alive', 'true')

    appCon.appendChild(microAppElement14)

    await new Promise((reslove) => {
      microAppElement14.addEventListener('mounted', () => {
        appCon.removeChild(microAppElement14)
      })

      // 应用已隐藏后执行unmountApp
      microAppElement14.addEventListener('afterhidden', () => {
        // 首次卸载不传 destroy，则直接返回，test-app14安然无恙
        unmountApp('test-app14').then(() => {
          expect(appInstanceMap.has('test-app14')).toBeTruthy()
          // 第二次卸载设置clearAliveState，触发应用卸载操作，应用状态被清除
          unmountApp('test-app14', {
            clearAliveState: true,
          }).then(() => {
            expect(appInstanceMap.has('test-app14')).toBeTruthy()
            expect(appInstanceMap.get('test-app14')?.getAppState()).toBe(appStates.UNMOUNT)
            reslove(true)
          })
        })
      })
    })

    // 场景4: 强制删除已经推入后台的keep-alive应用
    const microAppElement15 = document.createElement('micro-app')
    microAppElement15.setAttribute('name', 'test-app15')
    microAppElement15.setAttribute('url', `http://127.0.0.1:${ports.create_app}/umd1`)
    microAppElement15.setAttribute('keep-alive', 'true')

    appCon.appendChild(microAppElement15)

    await new Promise((reslove) => {
      microAppElement15.addEventListener('mounted', () => {
        appCon.removeChild(microAppElement15)
      })

      // 应用已隐藏后执行unmountApp
      microAppElement15.addEventListener('afterhidden', () => {
        unmountApp('test-app15', {
          destroy: true,
        }).then(() => {
          expect(appInstanceMap.has('test-app15')).toBeFalsy()
          reslove(true)
        })
      })
    })

    // 场景5: 强制删除正在运行的app
    const microAppElement16 = document.createElement('micro-app')
    microAppElement16.setAttribute('name', 'test-app16')
    microAppElement16.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)
    microAppElement16.setAttribute('destroy', 'attr-of-destroy')
    microAppElement16.setAttribute('destory', 'attr-of-destory')

    appCon.appendChild(microAppElement16)

    await new Promise((reslove) => {
      microAppElement16.addEventListener('mounted', () => {
        unmountApp('test-app16', {
          destroy: true,
        }).then(() => {
          expect(appInstanceMap.has('test-app16')).toBeFalsy()
          expect(microAppElement16.getAttribute('destroy')).toBe('attr-of-destroy')
          expect(microAppElement16.getAttribute('destory')).toBe('attr-of-destory')
          reslove(true)
        })
      })
    })

    // 场景6: 卸载正在运行的keep-alive应用并清空状态
    const microAppElement17 = document.createElement('micro-app')
    microAppElement17.setAttribute('name', 'test-app17')
    microAppElement17.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)
    microAppElement17.setAttribute('keep-alive', 'attr-of-keep-alive')

    appCon.appendChild(microAppElement17)

    await new Promise((reslove) => {
      microAppElement17.addEventListener('mounted', () => {
        unmountApp('test-app17', {
          clearAliveState: true,
        }).then(() => {
          expect(appInstanceMap.get('test-app17')?.getAppState()).toBe(appStates.UNMOUNT)
          expect(microAppElement17.getAttribute('keep-alive')).toBe('attr-of-keep-alive')
          reslove(true)
        })
      })
    })

    // 场景7: 正常卸载一个keep-alive应用，保留状态
    const microAppElement18 = document.createElement('micro-app')
    microAppElement18.setAttribute('name', 'test-app18')
    microAppElement18.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)
    microAppElement18.setAttribute('keep-alive', 'true')

    appCon.appendChild(microAppElement18)

    await new Promise((reslove) => {
      microAppElement18.addEventListener('mounted', () => {
        unmountApp('test-app18').then(() => {
          expect(appInstanceMap.get('test-app18')?.getKeepAliveState()).toBe(keepAliveStates.KEEP_ALIVE_HIDDEN)
          reslove(true)
        })
      })
    })
  })

  // 测试 unmountAllApps 方法
  test('test unmountAllApps method', async () => {
    const microAppElement19 = document.createElement('micro-app')
    microAppElement19.setAttribute('name', 'test-app19')
    microAppElement19.setAttribute('url', `http://127.0.0.1:${ports.create_app}/common`)
    microAppElement19.setAttribute('destroy', 'true')

    appCon.appendChild(microAppElement19)

    await new Promise((reslove) => {
      microAppElement19.addEventListener('mounted', () => {
        unmountAllApps().then(() => {
          expect(appInstanceMap.has('test-app19')).toBeFalsy()
          reslove(true)
        })
      })
    })
  })
})
