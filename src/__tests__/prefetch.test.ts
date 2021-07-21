/* eslint-disable promise/param-names */
import './common'
import microApp from '..'
import preFetch from '../prefetch'

global.console.warn = jest.fn()
global.console.error = jest.fn()

test('coverage branch for prefetch', async () => {
  microApp.start()

  preFetch(123 as any) // 非法的入参
  preFetch([{ name: 'test-app1', url: 'http://www.micro-app-test.com' }]) // 正常入参
  await new Promise((reslove) => {
    setTimeout(() => {
      reslove(true)
    }, 100)
  })
})
