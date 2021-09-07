/* eslint-disable promise/param-names */
import { commonStartEffect, releaseAllEffect, ports } from './common'
import microApp from '..'
import preFetch from '../prefetch'
import { globalLinks } from '../source/links'
import { globalScripts } from '../source/scripts'

describe('prefetch', () => {
  // let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.prefetch)
    // appCon = document.querySelector('#app-container')!

    microApp.start({
      globalAssets: {
        js: [
          `http://127.0.0.1:${ports.prefetch}/common/script1.js`,
          `http://127.0.0.1:${ports.prefetch}/common/script1.js`,
          'http://not-exist.com/xxx.js'
        ],
        css: [
          `http://127.0.0.1:${ports.prefetch}/common/link1.css`,
          `http://127.0.0.1:${ports.prefetch}/common/link1.css`,
          'http://not-exist.com/xxx.css'
        ],
      }
    })
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // sepecial case
  test('coverage branch for prefetch', async () => {
    preFetch(123 as any) // 非法的入参
    preFetch([{ name: 'test-app1', url: 'http://www.micro-app-test.com' }]) // 正常入参
    await new Promise((reslove) => {
      setTimeout(() => {
        reslove(true)
      }, 100)
    })
  })

  test('globalAssets should work normal', async () => {
    expect(globalLinks.get(`http://127.0.0.1:${ports.prefetch}/common/link1.css`)).not.toBeNull()
    expect(globalScripts.get(`http://127.0.0.1:${ports.prefetch}/common/script1.js`)).not.toBeNull()
    await new Promise((reslove) => {
      setTimeout(() => {
        reslove(true)
      }, 100)
    })
  })
})
