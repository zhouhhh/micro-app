/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from './common'
import { appInstanceMap } from '../create_app'
import MicroAppElement from '../micro_app_element'
import microApp from '..'
import { defer } from '../libs/utils'

describe('micro_app_element', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.micro_app_element)
    appCon = document.querySelector('#app-container')!

    microApp.start({
      preFetchApps: [
        {
          name: 'test-app1',
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
        expect(appInstanceMap.size).toBe(2)
        reslove(true)
      }, false)
    })
  })

  // 新建的app与预加载的app冲突
  test('app3 has same name with prefetch app1 but the url is different', () => {
    const microappElement3 = document.createElement('micro-app')
    microappElement3.setAttribute('name', 'test-app1')
    microappElement3.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/ssr-render/`)

    appCon.appendChild(microappElement3)

    expect(console.error).toHaveBeenCalledWith(`[micro-app] the url: http://127.0.0.1:${ports.micro_app_element}/ssr-render/ is different from prefetch url: http://127.0.0.1:${ports.micro_app_element}/common/`)
  })

  // name冲突
  test('app4 has same name with app2 but the url is different', () => {
    const microappElement4 = document.createElement('micro-app')
    microappElement4.setAttribute('name', 'test-app2')
    microappElement4.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    appCon.appendChild(microappElement4)

    expect(console.error).toHaveBeenCalledWith('[micro-app] an app named test-app2 already exists')
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
        expect(console.error).toBeCalledWith('[micro-app] an app named test-app2 already exists')
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
        expect(microappElement8.url).toBe(`http://127.0.0.1:${ports.micro_app_element}/common/`)
        reslove(true)
      })
    })

    appInstanceMap.delete('test-app8')
    appCon.removeChild(microappElement8)
  })

  // microAppCount为0后依然卸载应用，此时无法执行卸载
  test('unmount app when microAppCount less than 1', async () => {
    // 清空所有app
    appCon.innerHTML = ''
    const microappElement9 = document.createElement('micro-app')
    microappElement9.setAttribute('name', 'test-app9')
    microappElement9.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)

    appCon.appendChild(microappElement9)
    await new Promise((reslove) => {
      microappElement9.addEventListener('mounted', () => {
        // @ts-ignore
        microappElement9.disconnectedCallback()
        expect(MicroAppElement.microAppCount).toBe(0)
        reslove(true)
      }, false)
    })

    appCon.removeChild(microappElement9)
  })

  // 重新渲染带有shadowDom和baseurl属性应用 -- 分支覆盖
  test('coverage branch of remount app with shadowDom & baseurl', async () => {
    const microappElement10 = document.createElement('micro-app')
    microappElement10.setAttribute('name', 'test-app10')
    microappElement10.setAttribute('url', `http://127.0.0.1:${ports.micro_app_element}/common/`)
    microappElement10.setAttribute('shadowDom', 'true')
    microappElement10.setAttribute('baseurl', '/baseurl')

    appCon.appendChild(microappElement10)
    let mountCount = 0
    await new Promise((reslove) => {
      microappElement10.addEventListener('mounted', () => {
        mountCount++
        reslove(true)
      }, false)
    })

    appCon.removeChild(microappElement10)

    appCon.appendChild(microappElement10)

    await new Promise((reslove) => {
      setTimeout(() => {
        expect(mountCount).toBe(2) // 渲染2次
        reslove(true)
      }, 4)
    })

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
})
