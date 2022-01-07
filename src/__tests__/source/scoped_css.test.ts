/* eslint-disable promise/param-names, no-extend-native */
import { commonStartEffect, releaseAllEffect, ports, setAppName } from '../common/initial'
import { defer } from '../../libs/utils'
import microApp from '../..'

describe('source scoped_css', () => {
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.scoped_css)
    microApp.start()
    appCon = document.querySelector('#app-container')!
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 动态插入style标签，先插入后赋值
  test('set textContent after style element append to html', async () => {
    const microappElement1 = document.createElement('micro-app')
    microappElement1.setAttribute('name', 'test-app1')
    microappElement1.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement1)
    await new Promise((reslove) => {
      microappElement1.addEventListener('mounted', () => {
        setAppName('test-app1')
        // 动态创建style
        const dynamicStyle = document.createElement('style')
        document.head.appendChild(dynamicStyle)

        dynamicStyle.textContent = '* {margin: 0;} .test, html > .abc {color: red;}'

        defer(() => {
          expect(dynamicStyle.textContent).toBe('micro-app[name=test-app1] *{margin: 0;} micro-app[name=test-app1] .test, html > .abc{color: red;}')
          reslove(true)
        })
      }, false)
    })
  })

  // safari浏览器补全丢失的引号
  // 2022-1-7补充：已废弃
  test.skip('complete quotation marks in safari', async () => {
    const rawUserAgent = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.1 Safari/605.1.15',
      writable: true,
      configurable: true,
    })

    const microappElement2 = document.createElement('micro-app')
    microappElement2.setAttribute('name', 'test-app2')
    microappElement2.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement2)
    await new Promise((reslove) => {
      microappElement2.addEventListener('mounted', () => {
        setAppName('test-app2')
        // 动态创建style
        const dynamicStyle = document.createElement('style')
        dynamicStyle.textContent = '.test-content1 {content: no quota;} .test-content2 {content: none;} .test-content3 {content: url(http://www.micro-app-test.com/);}'

        document.head.appendChild(dynamicStyle)

        defer(() => {
          expect(dynamicStyle.textContent).toBe('micro-app[name=test-app2] .test-content1 {content: no quota;} micro-app[name=test-app2] .test-content2 {content: none;} micro-app[name=test-app2] .test-content3 {content: url(http://www.micro-app-test.com/);}')
          reslove(true)
        })
      }, false)
    })

    Object.defineProperty(navigator, 'userAgent', {
      value: rawUserAgent,
      writable: true,
      configurable: true,
    })
  })

  // 一些cssrules需要特殊处理
  test('some CSSRuleType should special handling', async () => {
    const microappElement3 = document.createElement('micro-app')
    microappElement3.setAttribute('name', 'test-app3')
    microappElement3.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement3)
    await new Promise((reslove) => {
      microappElement3.addEventListener('mounted', () => {
        setAppName('test-app3')
        // 动态创建style
        const dynamicStyle = document.createElement('style')
        dynamicStyle.textContent = '@font-face {font-family: test-font;} @media screen and (max-width: 300px) {body {background:lightblue;}} @supports (display: grid) {div {display: grid;}}'

        document.head.appendChild(dynamicStyle)

        defer(() => {
          expect(dynamicStyle.textContent).toBe('@font-face {font-family: test-font;} @media screen and (max-width: 300px) {micro-app[name=test-app3] micro-app-body{background:lightblue;}} @supports (display: grid) {micro-app[name=test-app3] div{display: grid;}}')
          reslove(true)
        })
      }, false)
    })
  })

  // 补全静态资源地址
  test('complete static resource address', async () => {
    const rewIndexOf = String.prototype.indexOf
    const safariPolyfill = `//127.0.0.1:${ports.scoped_css}/safari-polyfill.png`
    String.prototype.indexOf = function (searchString: string): number {
      if (searchString === safariPolyfill) {
        return -1
      }
      return rewIndexOf.call(this, searchString)
    }
    const microappElement4 = document.createElement('micro-app')
    microappElement4.setAttribute('name', 'test-app4')
    microappElement4.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement4)
    await new Promise((reslove) => {
      microappElement4.addEventListener('mounted', () => {
        setAppName('test-app4')
        // 动态创建style
        const dynamicStyle1 = document.createElement('style')
        dynamicStyle1.textContent = '.static-path1 { background: url(http://www.micro-app-test.com/img.jpeg)} .static-path2 { background: url(data:image/png;base64,iVB...)} .static-path3 { background: url(../path1/img.png)} .static-path4 { background: url(./path1/img.png)}'
        // @ts-ignore
        dynamicStyle1.__MICRO_APP_LINK_PATH__ = 'http://www.micro-app-test.com/css/dynamic.css'

        document.head.appendChild(dynamicStyle1)
        expect(dynamicStyle1.textContent).toBe('micro-app[name=test-app4] .static-path1{ background: url(http://www.micro-app-test.com/img.jpeg)} micro-app[name=test-app4] .static-path2{ background: url(data:image/png;base64,iVB...)} micro-app[name=test-app4] .static-path3{ background: url("http://www.micro-app-test.com/path1/img.png")} micro-app[name=test-app4] .static-path4{ background: url("http://www.micro-app-test.com/css/path1/img.png")}')

        reslove(true)
      }, false)
    })

    String.prototype.indexOf = rewIndexOf
  })

  // 分支覆盖
  test('covering special branches', async () => {
    // 执行样式隔离时app已经被卸载
    const microappElement5 = document.createElement('micro-app')
    microappElement5.setAttribute('name', 'test-app5')
    microappElement5.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/common/`)
    microappElement5.setAttribute('destroy', 'true')

    appCon.appendChild(microappElement5)
    appCon.removeChild(microappElement5)
  })

  // styled-component降级处理
  test('temporary handle for styled component', async () => {
    const microappElement7 = document.createElement('micro-app')
    microappElement7.setAttribute('name', 'test-app7')
    microappElement7.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/common/`)

    appCon.appendChild(microappElement7)

    await new Promise((reslove) => {
      microappElement7.addEventListener('mounted', () => {
        setAppName('test-app7')
        // 模拟生产环境styled-component style标签
        const dynamicStyle1 = document.createElement('style')
        document.head.appendChild(dynamicStyle1)
        dynamicStyle1.appendChild(document.createTextNode(''))
        const sheet = dynamicStyle1.sheet!
        sheet.insertRule('.imred {color: red;}', 0)
        setTimeout(() => {
          expect(dynamicStyle1.textContent).toBe('')
        }, 10)

        // 模拟开发环境styled-component style标签
        const dynamicStyle2 = document.createElement('style')
        dynamicStyle2.setAttribute('data-styled', 'active')
        document.head.appendChild(dynamicStyle2)
        dynamicStyle2.textContent = '.imred {color: red;}'
        setTimeout(() => {
          expect(dynamicStyle2.textContent).toBe('.imred {color: red;}')
        }, 10)

        // 正常的style
        const dynamicStyle3 = document.createElement('style')
        document.head.appendChild(dynamicStyle3)
        document.head.removeChild(dynamicStyle3)

        dynamicStyle3.appendChild(document.createTextNode(''))
        setTimeout(() => {
          expect(dynamicStyle3.textContent).toBe('')
        }, 10)

        reslove(true)
      }, false)
    })
  })

  // 分支覆盖 -- 同一个style元素被执行了两次 -- styleElement.__MICRO_APP_HAS_SCOPED__
  test('coverage: styleElement.__MICRO_APP_HAS_SCOPED__', async () => {
    const microappElement8 = document.createElement('micro-app')
    microappElement8.setAttribute('name', 'test-app8')
    microappElement8.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement8)

    await new Promise((reslove) => {
      microappElement8.addEventListener('mounted', () => {
        setAppName('test-app8')
        const dynamicStyle1 = document.createElement('style')
        document.head.appendChild(dynamicStyle1)
        document.head.removeChild(dynamicStyle1)
        dynamicStyle1.textContent = 'div {color: red}'
        document.head.appendChild(dynamicStyle1)

        expect(dynamicStyle1.textContent).toBe('micro-app[name=test-app8] div{color: red}')
        reslove(true)
      }, false)
    })
  })

  // 使用large.css提升覆盖率
  test('coverage: use large.css improves coverage', async () => {
    const microappElement9 = document.createElement('micro-app')
    microappElement9.setAttribute('name', 'test-app9')
    microappElement9.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement9)

    await new Promise((reslove) => {
      microappElement9.addEventListener('mounted', () => {
        setAppName('test-app9')
        const dynamicLink = document.createElement('link')
        dynamicLink.setAttribute('href', `http://127.0.0.1:${ports.scoped_css}/common/large.css`)
        dynamicLink.setAttribute('rel', 'stylesheet')
        dynamicLink.setAttribute('type', 'text/css')
        document.head.appendChild(dynamicLink)

        dynamicLink.onload = () => {
          reslove(true)
        }
      }, false)
    })
  })

  // 处理所有错误情况
  test('coverage of all failures', async () => {
    const microappElement10 = document.createElement('micro-app')
    microappElement10.setAttribute('name', 'test-app10')
    microappElement10.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement10)

    await new Promise((reslove) => {
      microappElement10.addEventListener('mounted', () => {
        setAppName('test-app10')
        const dynamicStyle1 = document.createElement('style')
        // error of selector
        dynamicStyle1.__MICRO_APP_LINK_PATH__ = 'http://micro-app-test.com/unimportant.css'
        dynamicStyle1.textContent = 'div {'
        document.head.appendChild(dynamicStyle1)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of comment
        const dynamicStyle2 = document.createElement('style')
        dynamicStyle2.textContent = '/* sdfs'
        document.head.appendChild(dynamicStyle2)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of selector missing
        const dynamicStyle3 = document.createElement('style')
        dynamicStyle3.textContent = '{}'
        document.head.appendChild(dynamicStyle3)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of Declaration missing '{'
        const dynamicStyle4 = document.createElement('style')
        dynamicStyle4.textContent = 'div'
        document.head.appendChild(dynamicStyle4)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of property missing ':'
        const dynamicStyle5 = document.createElement('style')
        dynamicStyle5.textContent = 'div {color}'
        document.head.appendChild(dynamicStyle5)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // special scene of empty value
        const dynamicStyle6 = document.createElement('style')
        dynamicStyle6.textContent = 'div {color:;}'
        document.head.appendChild(dynamicStyle6)
        expect(dynamicStyle6.textContent).toBe('micro-app[name=test-app10] div{color:;}')

        // error of @keyframes missing name
        const dynamicStyle7 = document.createElement('style')
        dynamicStyle7.textContent = '@keyframes '
        document.head.appendChild(dynamicStyle7)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of @keyframes missing '{'
        const dynamicStyle8 = document.createElement('style')
        dynamicStyle8.textContent = '@keyframes name'
        document.head.appendChild(dynamicStyle8)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of @keyframes missing '}'
        const dynamicStyle9 = document.createElement('style')
        dynamicStyle9.textContent = '@keyframes name {'
        document.head.appendChild(dynamicStyle9)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of @media, @supports, @document, @host missing '{'
        const dynamicStyle10 = document.createElement('style')
        dynamicStyle10.textContent = '@media (min-width: 500px) '
        document.head.appendChild(dynamicStyle10)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of @media, @supports, @document, @host missing '}'
        const dynamicStyle11 = document.createElement('style')
        dynamicStyle11.textContent = '@media (min-width: 500px) {'
        document.head.appendChild(dynamicStyle11)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of @font-face, @page missing '{'
        const dynamicStyle12 = document.createElement('style')
        dynamicStyle12.textContent = '@font-face'
        document.head.appendChild(dynamicStyle12)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        // error of @font-face, @page missing '}'
        const dynamicStyle13 = document.createElement('style')
        dynamicStyle13.textContent = '@font-face {'
        document.head.appendChild(dynamicStyle13)
        expect(console.error).toBeCalledWith(expect.any(String), expect.any(Error))

        reslove(true)
      }, false)
    })
  })

  // 通过注释实现的内置的控制规则
  test('Using configuration comments', async () => {
    const microappElement11 = document.createElement('micro-app')
    microappElement11.setAttribute('name', 'test-app11')
    microappElement11.setAttribute('url', `http://127.0.0.1:${ports.scoped_css}/dynamic/`)

    appCon.appendChild(microappElement11)

    await new Promise((reslove) => {
      microappElement11.addEventListener('mounted', () => {
        setAppName('test-app11')
        // scopecss-disable-next-line
        const dynamicStyle1 = document.createElement('style')
        dynamicStyle1.textContent = '/* scopecss-disable-next-line */div{}span{}'
        document.head.appendChild(dynamicStyle1)
        expect(dynamicStyle1.textContent).toBe('/* scopecss-disable-next-line */div{}micro-app[name=test-app11] span{}')

        // scopecss-disable with special selectors
        const dynamicStyle2 = document.createElement('style')
        dynamicStyle2.textContent = '/* scopecss-disable div, span */div{background: url(/test.png);}span{}header{}'
        document.head.appendChild(dynamicStyle2)
        expect(dynamicStyle2.textContent).toBe('/* scopecss-disable div, span */div{background: url("http://127.0.0.1:9010/test.png");}span{}micro-app[name=test-app11] header{}')

        // scopecss-disable
        const dynamicStyle3 = document.createElement('style')
        dynamicStyle3.textContent = '/* ! scopecss-disable */div{}span{}header{}'
        document.head.appendChild(dynamicStyle3)
        expect(dynamicStyle3.textContent).toBe('/* ! scopecss-disable */div{}span{}header{}')

        // scopecss-enable
        const dynamicStyle4 = document.createElement('style')
        dynamicStyle4.textContent = '/* ! scopecss-disable */div{}span{}/* ! scopecss-enable */header{}'
        document.head.appendChild(dynamicStyle4)
        expect(dynamicStyle4.textContent).toBe('/* ! scopecss-disable */div{}span{}/* ! scopecss-enable */micro-app[name=test-app11] header{}')

        // coverage branch of ignore config -- 忽略属性
        const dynamicStyle5 = document.createElement('style')
        dynamicStyle5.textContent = 'div{/* scopecss-disable-next-line */background: url(/test.png);}span{}header{}'
        document.head.appendChild(dynamicStyle5)
        expect(dynamicStyle5.textContent).toBe('micro-app[name=test-app11] div{/* scopecss-disable-next-line */background: url(/test.png);}micro-app[name=test-app11] span{}micro-app[name=test-app11] header{}')

        reslove(true)
      }, false)
    })
  })
})
