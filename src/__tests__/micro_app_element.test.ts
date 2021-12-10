/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from './common/initial'
import { appInstanceMap } from '../create_app'
import microApp from '..'
import { defer } from '../libs/utils'

describe('micro_app_element', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.micro_app_element)
    appCon = document.querySelector('#app-container')!
    window.keepAliveListener = jest.fn()

    microApp.start({
      preFetchApps: [
        {
          name: 'test-app1',
          url: `http://127.0.0.1:${ports.micro_app_element}/common`,
        },
        {
          name: 'test-app12',
          url: `http://127.0.0.1:${ports.micro_app_element}/common`,
        },
      ]
    })
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 正常渲染
  test('render app2 as usual', async () => {
    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/ssr-render/`)
    microappElement2.setAttribute('baseurl', '/baseurl')

    appCon.appendChild(microappElement2)

    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(3)
        reslove(true)
      }, false)
    })
  })

  // 当新的app与旧的app name相同而url不同时，且旧app为预加载，则删除旧app的缓存，使用新app覆盖
  test('app3 has same name with prefetch app1 but the url is different', () => {
    const microappElement3 = document.createElement('micro-app')
    microappElement3.setAttribute('name', 'test-app1')
    microappElement3.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/ssr-render/`)

    appCon.appendChild(microappElement3)

    expect(console.warn).toHaveBeenCalled()
  })

  // name冲突
  test('app4 has same name with app2 but the url is different', () => {
    const microappElement4 = document.createElement('micro-app')
    microappElement4.setAttribute('name', 'test-app2')
    microappElement4.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    appCon.appendChild(microappElement4)

    expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app2: app name conflict, an app named test-app2 is running')
  })

  // 非法url
  test('it should log error when url is invalid', () => {
    const microappElement5 = document.createElement('micro-app')
    microappElement5.setAttribute('name', 'test-app2')
    microappElement5.setAttribute('url', 'abc')

    appCon.appendChild(microappElement5)

    expect(console.error).toBeCalledTimes(2)
  })

  // 修改name或url失败
  test('it should deal with an error when change name or url failed', async () => {
    const microappElement6 = document.createElement('micro-app')
    microappElement6.setAttribute('name', 'test-app6')
    microappElement6.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    microappElement6.setAttribute('name', 'test-app2')

    await new Promise((reslove) => {
      defer(() => {
        expect(console.error).toBeCalledWith('[micro-app] app test-app6: app name conflict, an app named test-app2 is running')
        expect(microappElement6.getAttribute('name')).toBe('test-app6')
        reslove(true)
      })
    })

    microappElement6.setAttribute('name', 'test-app2')
    microappElement6.setAttribute('url', 'abc')

    await new Promise((reslove) => {
      defer(() => {
        expect(console.error).toBeCalledTimes(3)
        expect(microappElement6.getAttribute('name')).toBe('test-app6')
        reslove(true)
      })
    })
  })

  // 重复定义相同名称元素抛出警告
  test('it should log warn when customElement already exists', () => {
    microApp.start()
    expect(console.warn).toBeCalledWith('[micro-app] element micro-app is already defined')
  })

  // 覆盖修改name/url属性的一些特殊分支
  test('coverage special branch when change attribute name/url', async () => {
    const microappElement7 = document.createElement('micro-app')
    microappElement7.setAttribute('name', 'test-app7')
    microappElement7.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    appCon.appendChild(microappElement7)
    await new Promise((reslove) => {
      microappElement7.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })

    microappElement7.setAttribute('name', 'new-name') // 设置新name
    microappElement7.setAttribute('name', 'test-app7') // 之后立即恢复之前的值，因为回调是异步处理的，所以会发现属性name和实例名称name是一致的，以此来覆盖某个分支

    await new Promise((reslove) => {
      defer(() => {
        expect(microappElement7.getAttribute('name')).toBe('test-app7')
        microappElement7.setAttribute('name', 'new-name')
        reslove(true)
      })
    })

    const microappElement8 = document.createElement('micro-app')
    microappElement8.setAttribute('name', 'test-app8')
    microappElement8.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    appCon.appendChild(microappElement8)
    await new Promise((reslove) => {
      microappElement8.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })

    microappElement8.setAttribute('url', 'abc') // 无效的url

    await new Promise((reslove) => {
      defer(() => {
        expect(microappElement8.getAttribute('url')).toBe('abc')
        // @ts-ignore
        expect(microappElement8.appUrl).toBe(`http://127.0.0.1:${ports.micro_app_element}/common/`)
        reslove(true)
      })
    })

    appInstanceMap.delete('test-app8')
    appCon.removeChild(microappElement8)
  })

  // 重新渲染带有shadowDom和baseurl属性应用 -- 分支覆盖
  test('coverage branch of remount app with shadowDom & baseurl', async () => {
    const microappElement10 = document.createElement('micro-app')
    microappElement10.setAttribute('name', 'test-app10')
    microappElement10.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)
    microappElement10.setAttribute('shadowDom', 'true')
    microappElement10.setAttribute('baseurl', '/baseurl')

    appCon.appendChild(microappElement10)
    await new Promise((reslove) => {
      microappElement10.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })

    appCon.removeChild(microappElement10)

    appCon.appendChild(microappElement10)

    // 分支覆盖
    const microappElement11 = document.createElement('micro-app')
    microappElement11.setAttribute('name', 'test-app11')
    microappElement11.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    appCon.appendChild(microappElement11)
    await new Promise((reslove) => {
      microappElement11.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })

    appCon.removeChild(microappElement11)

    appCon.appendChild(microappElement11)
  })

  // 修改name或url成功，且修改后的应用为预加载或已经卸载的应用，此时直接从缓存中重新挂载
  test('change name or url to an exist prefetch/unmount app ', async () => {
    const microappElement13 = document.createElement('micro-app')
    microappElement13.setAttribute('name', 'test-app13')
    microappElement13.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/dynamic/`)

    appCon.appendChild(microappElement13)
    await new Promise((reslove) => {
      function handleMounted () {
        microappElement13.removeEventListener('mounted', handleMounted)
        // test-app12# 会格式化为 test-app12
        microappElement13.setAttribute('name', 'test-app12#')
        defer(() => {
          expect(microappElement13.getAttribute('name')).toBe('test-app12')
        })
        microappElement13.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common`)
        reslove(true)
      }
      microappElement13.addEventListener('mounted', handleMounted, false)
    })

    await new Promise((reslove) => {
      defer(() => {
        expect(appInstanceMap.get('test-app12')?.isPrefetch).toBeFalsy()
        reslove(true)
      })
    })
  })

  // getBaseRouteCompatible 分支覆盖
  test('coverage branch of getBaseRouteCompatible', async () => {
    const microappElement14 = document.createElement('micro-app')
    microappElement14.setAttribute('name', 'test-app14')
    microappElement14.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)
    microappElement14.setAttribute('baseroute', '/path')

    appCon.appendChild(microappElement14)
    await new Promise((reslove) => {
      microappElement14.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })
  })

  // 先插入micro-app元素，后设置name、url属性
  test('set name & url after connectedCallback', async () => {
    const microappElement15 = document.createElement('micro-app')
    appCon.appendChild(microappElement15)

    microappElement15.setAttribute('name', 'test-app15')
    microappElement15.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    await new Promise((reslove) => {
      microappElement15.addEventListener('mounted', () => {
        reslove(true)
      }, false)
    })
  })

  // 当新的app与旧的app name相同而url不同时，且旧app已经卸载，则删除旧app的缓存，使用新app覆盖
  test('overwrite unmount app when name conflicts', async () => {
    const microAppElement16 = document.createElement('micro-app')
    microAppElement16.setAttribute('name', 'test-app16')
    microAppElement16.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common`)

    appCon.appendChild(microAppElement16)

    await new Promise((reslove) => {
      microAppElement16.addEventListener('mounted', () => {
        appCon.removeChild(microAppElement16)
        reslove(true)
      })
    })

    const microAppElement17 = document.createElement('micro-app')
    // name相同，url不同
    microAppElement17.setAttribute('name', 'test-app16')
    microAppElement17.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/dynamic/`)

    appCon.appendChild(microAppElement17)

    await new Promise((reslove) => {
      microAppElement17.addEventListener('mounted', () => {
        expect(appInstanceMap.get('test-app16')!.url).toBe(`http://127.0.0.1:${ports.micro_app_element}/dynamic/`)
        reslove(true)
      })
    })
  })

  // 测试一些带有特殊符号的name
  test('test name with special characters', async () => {
    // scene1: 格式化后name为空
    const microAppElement18 = document.createElement('micro-app')
    microAppElement18.setAttribute('name', '123$')
    expect(console.error).toBeCalledWith('[micro-app] Invalid attribute name 123$')

    // scene2: 前后name不一致，重新赋值
    const microAppElement19 = document.createElement('micro-app')
    microAppElement19.setAttribute('name', 'test-app19$')
    expect(microAppElement19.getAttribute('name')).toBe('test-app19')
  })

  // 测试ssr配置
  test('test ssr mode', async () => {
    const microAppElement20 = document.createElement('micro-app')
    microAppElement20.setAttribute('name', 'test-app20')
    microAppElement20.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common`)
    microAppElement20.setAttribute('ssr', 'true')

    // 场景1: 测试正常渲染的ssr应用
    appCon.appendChild(microAppElement20)

    // connectedCallback中会对url地址进行格式化，因为jest环境下，location.pathname 默认为 '/'，所以/common被截掉
    expect(microAppElement20.ssrUrl).toBe(`http://127.0.0.1:${ports.micro_app_element}/`)

    // 场景2: 再次渲染时，去除ssr配置，如果有 ssrUrl，则进行删除
    appCon.removeChild(microAppElement20)
    microAppElement20.removeAttribute('ssr')
    appCon.appendChild(microAppElement20)

    expect(microAppElement20.ssrUrl).toBe('')

    // 场景3: ssr模式下动态修改url的值，此时ssrUrl会进行同步更新
    appCon.removeChild(microAppElement20)
    microAppElement20.setAttribute('ssr', 'true')
    appCon.appendChild(microAppElement20)

    await new Promise((reslove) => {
      microAppElement20.addEventListener('mounted', () => {
        microAppElement20.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/dynamic/`)
        defer(() => {
          expect(microAppElement20.ssrUrl).toBe(`http://127.0.0.1:${ports.micro_app_element}/`)
          reslove(true)
        })
      })
    })

    // 场景4: ssr模式已经渲染，修改url的值的同时去除ssr配置，需要将ssrUrl的值删除
    const microAppElement21 = document.createElement('micro-app')
    microAppElement21.setAttribute('name', 'test-app21')
    microAppElement21.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common`)
    microAppElement21.setAttribute('ssr', 'true')

    appCon.appendChild(microAppElement21)

    await new Promise((reslove) => {
      microAppElement21.addEventListener('mounted', () => {
        microAppElement21.removeAttribute('ssr')
        microAppElement21.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/dynamic/`)
        defer(() => {
          expect(microAppElement21.ssrUrl).toBe('')
          reslove(true)
        })
      })
    })
  })

  // test keep-alive 场景1: 正常渲染、隐藏、重新渲染
  test('normal process of keep-alive', async () => {
    const microappElement22 = document.createElement('micro-app')
    microappElement22.setAttribute('name', 'test-app22')
    microappElement22.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)
    microappElement22.setAttribute('keep-alive', 'true')

    appCon.appendChild(microappElement22)

    await new Promise((reslove) => {
      microappElement22.addEventListener('mounted', () => {
        reslove(true)
      })
    })

    const beforeShowListener = jest.fn()
    const afterShowListener = jest.fn()
    const afterHiddenListener = jest.fn()

    microappElement22.addEventListener('beforeshow', beforeShowListener)
    microappElement22.addEventListener('aftershow', afterShowListener)
    microappElement22.addEventListener('afterhidden', afterHiddenListener)

    appCon.removeChild(microappElement22)
    // dispatch event afterhidden to base app and micro app
    expect(afterHiddenListener).toBeCalledWith(expect.any(CustomEvent))
    expect(window.keepAliveListener).toBeCalledWith('afterhidden')

    appCon.appendChild(microappElement22)

    defer(() => {
      // dispatch event beforeshow to base app and micro app
      expect(beforeShowListener).toBeCalledWith(expect.any(CustomEvent))
      expect(window.keepAliveListener).toBeCalledWith('beforeshow')

      // dispatch event aftershow to base app and micro app
      expect(afterShowListener).toBeCalledWith(expect.any(CustomEvent))
      expect(window.keepAliveListener).toBeCalledWith('aftershow')
    })

    // 分支覆盖之 keep-alive 模式下开启 shadowRoot
    appCon.removeChild(microappElement22)
    microappElement22.setAttribute('shadowDom', 'true')
    appCon.appendChild(microappElement22)
  })

  // test keep-alive 场景2: 二次渲染时，url冲突，卸载旧应用，重新渲染
  test('url conflict when remount of keep-alive', async () => {
    const microappElement23 = document.createElement('micro-app')
    microappElement23.setAttribute('name', 'test-app23')
    microappElement23.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)
    microappElement23.setAttribute('keep-alive', 'true')

    appCon.appendChild(microappElement23)

    await new Promise((reslove) => {
      microappElement23.addEventListener('mounted', () => {
        reslove(true)
      })
    })

    appCon.removeChild(microappElement23)

    const microappElement24 = document.createElement('micro-app')
    microappElement24.setAttribute('name', 'test-app23')
    microappElement24.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/dynamic/`)

    appCon.appendChild(microappElement24)

    expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app23: app name conflict, an app named test-app23 is running')
  })

  // test keep-alive 场景3: 修改micro-app name、url属性相关操作
  test('url conflict when remount of keep-alive', async () => {
    const microappElement25 = document.createElement('micro-app')
    microappElement25.setAttribute('name', 'test-app25')
    microappElement25.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/dynamic/`)
    microappElement25.setAttribute('keep-alive', 'true')

    appCon.appendChild(microappElement25)

    await new Promise((reslove) => {
      microappElement25.addEventListener('mounted', () => {
        reslove(true)
      })
    })

    // afterhidden事件指向test-app25
    const afterHiddenListenerForTestApp25 = jest.fn()
    microappElement25.addEventListener('afterhidden', afterHiddenListenerForTestApp25)

    // beforeshow和aftershow事件指向test-app23
    const beforeShowListenerForTestApp23 = jest.fn()
    const afterShowListenerForTestApp23 = jest.fn()
    microappElement25.addEventListener('beforeshow', beforeShowListenerForTestApp23)
    microappElement25.addEventListener('aftershow', afterShowListenerForTestApp23)

    // 修改name和url
    microappElement25.setAttribute('name', 'test-app23')
    microappElement25.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    await new Promise((reslove) => {
      // name和url的修改是异步的，这里放在定时器中执行
      setTimeout(() => {
        // dispatch event afterhidden to base app
        expect(afterHiddenListenerForTestApp25).toBeCalledWith(expect.any(CustomEvent))

        // dispatch event beforeshow to base app
        expect(beforeShowListenerForTestApp23).toBeCalledWith(expect.any(CustomEvent))

        // dispatch event aftershow to base app
        expect(afterShowListenerForTestApp23).toBeCalledWith(expect.any(CustomEvent))

        reslove(true)
      }, 50)
    })

    // 修改name为test-app25，test-app25为隐藏状态，但url没有修改，此时url冲突，keep-alive报错
    microappElement25.setAttribute('name', 'test-app25')

    await new Promise((reslove) => {
      defer(() => {
        expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app25: app name conflict, an app named test-app25 is running')
        reslove(true)
      })
    })
  })
})
