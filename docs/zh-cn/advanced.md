## 1、自定义fetch
通过自定义fetch替换框架自带的fetch，可以修改fetch配置(添加cookie或header信息等等)，或拦截HTML、JS、CSS等静态资源。

自定义的fetch必须是一个返回string类型的Promise。

```js
import microApp from '@micro-zoe/micro-app'

microApp.start({
  /**
   * 自定义fetch
   * @param {string} url 静态资源地址
   * @param {object} options fetch请求配置项
   * @param {string|null} appName 应用名称
   * @returns Promise<string>
  */
  fetch (url, options, appName) {
    if (url === 'http://localhost:3001/error.js') {
      // 删除 http://localhost:3001/error.js 的内容
      return Promise.resolve('')
    }
    
    let config = null
    if (url === 'http://localhost:3001/micro-app/react16/') {
      config = {
        // 添加header信息
        headers: {
          'custom-head': 'custom-head',
        },
        // micro-app默认不带cookie，如果需要添加cookie需要配置credentials
        credentials: 'include', // 请求时带上cookie
      }
    }

    return fetch(url, Object.assign(options, config)).then((res) => {
      return res.text()
    })
  }
})
```

> [!NOTE]
> 1、micro-app默认不带cookie，如果需要添加cookie需要重写fetch，添加credentials配置
>
> 2、如果跨域请求带cookie，那么`Access-Control-Allow-Origin`不能设置为`*`，这一点需要注意

## 2、适配vite
当子应用是vite应用时需要做特别的适配，适配vite的代价是巨大的，我们必须关闭沙箱功能，因为沙箱在`module script`下不支持，这导致大部分功能失效，包括：环境变量、样式隔离、元素隔离、数据通信、资源地址补全、baseroute 等。

在嵌入vite子应用时，`micro-app`的功能只负责渲染，其它的行为由应用自行决定，这包括如何防止样式、JS变量、元素的冲突。

在module模式下，引入的资源大多为相对地址，我们的兼容主要做的事情就是将地址补全。下面给出了一种解决思路，但这不是唯一的方式，只要能够将地址补全，任何方式都是可以的。

### 👇 子应用的修改
`请确保vite版本>=2.5.0`

##### 1、修改vite.config.js
```js
// vite.config.js
export default defineConfig({
  base: `${process.env.NODE_ENV === 'production' ? 'http://my-site.com' : ''}/basename/`,
  plugins: [
    ...
    // 自定义插件
    (function () {
      let basePath = ''
      return {
        name: "vite:micro-app",
        apply: 'build', // 只在生产环境生效
        configResolved(config) {
          // 获取资源地址前缀
          basePath = `${config.base}${config.build.assetsDir}/`
        },
        renderChunk(code, chunk) {
          // build后，import会通过相对地址引入模块，需要将其补全
          if (chunk.fileName.endsWith('.js') && /(from|import)(\s*['"])(\.\.?\/)/g.test(code)) {
            code = code.replace(/(from|import)(\s*['"])(\.\.?\/)/g, (all, $1, $2, $3) => {
              return all.replace($3, new URL($3, basePath))
            })
          }
          return code
        }
      }
    })(),
  ],
})
```

##### 2、路由
vite环境下，当路由的baseName和vite.base值不相等，两者会进行拼接，这导致无法自定义baseName来适配基座应用的路由。

有两种方式解决这个问题：
- 方式一：子应用使用hash路由 
- 方式二：子应用根据基座路由单独打包一个版本，这个版本的子应用无法单独访问，必须嵌入基座中运行。

##### 3、静态资源
图片等静态资源需要使用绝对地址，可以使用 `new URL('../assets/logo.png', import.meta.url)` 等方式获取资源的全链接地址。

### 👇 基座应用的修改
`请确保vite版本>=2.5.0`

##### 1、关闭沙箱并使用内联script模式
```js
<micro-app
  name='child-name'
  url='http://localhost:3001/basename/'
  inline // 使用内联script模式
  disableSandbox // 关闭沙箱
>
```

##### 2、处理子应用静态资源
写一个简易的插件，对开发环境的子应用进行处理，补全静态资源地址。

```js
import microApp from '@micro-zoe/micro-app'

microApp.start({
  plugins: {
    modules: {
      // appName即应用的name值
      appName: [{
        loader(code) {
          if (process.env.NODE_ENV === 'development') {
            // 这里 basename 需要和子应用vite.config.js中base的配置保持一致
            code = code.replace(/(from|import)(\s*['"])(\/basename\/)/g, all => {
              return all.replace('/basename/', '子应用域名/basename/')
            })
          }

          return code
        }
      }]
    }
  }
})
```

> [!TIP]
> 1、关闭沙箱后的子应用可以直接访问全局window，可以通过挂载全局变量来进行数据通信和其它操作。
>
> 2、适配vite本质上是适配module脚本，其它非vite构建的module脚本也可以采用相同的思路处理。
>
> 3、请确保vite版本>=2.5.0


## 3、内存优化
虽然我们在卸载子应用时对变量和事件进行了清除，但仍有一些变量无法回收。如果子应用渲染和卸载非常频繁，建议通过下面方式进行内存优化。

#### 在window上注册mount和unmount方法

<!-- tabs:start -->

#### ** React **
```js
// index.js
import React from "react"
import ReactDOM from "react-dom"
import App from './App'

// 👇 将渲染操作放入 mount 函数
export function mount () {
  ReactDOM.render(<App />, document.getElementById("root"))
}

// 👇 将卸载操作放入 unmount 函数
export function unmount () {
  ReactDOM.unmountComponentAtNode(document.getElementById("root"))
}

// 微前端环境下，注册mount和unmount方法
if (window.__MICRO_APP_ENVIRONMENT__) {
  window[`micro-app-${window.__MICRO_APP_NAME__}`] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount()
}
```

#### ** Vue2 **
这里只介绍配合`vue-router3.x`的用法

```js
// main.js
import Vue from 'vue'
import router from './router'
import App from './App.vue'

let app = null
// 👇 将渲染操作放入 mount 函数
function mount () {
  app = new Vue({
    router,
    render: h => h(App),
  }).$mount('#app')
}

// 👇 将卸载操作放入 unmount 函数
function unmount () {
  app.$destroy()
  app.$el.innerHTML = ''
  app = null
}

// 微前端环境下，注册mount和unmount方法
if (window.__MICRO_APP_ENVIRONMENT__) {
  window[`micro-app-${window.__MICRO_APP_NAME__}`] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount()
}
```

#### ** Vue3 **
这里只介绍配合`vue-router4.x`的用法

```js
// main.js
import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import routes from './router'
import App from './App.vue'

let app = null
let router = null
let history = null
// 👇 将渲染操作放入 mount 函数
function mount () {
  history = VueRouter.createWebHistory(window.__MICRO_APP_BASE_ROUTE__ || '/')
  router = VueRouter.createRouter({
    history,
    routes,
  })

  app = createApp(App)
  app.use(router)
  app.mount('#app')
}

// 👇 将卸载操作放入 unmount 函数
function unmount () {
  app.unmount()
  history.destroy()
  app = null
  router = null
  history = null
}

// 微前端环境下，注册mount和unmount方法
if (window.__MICRO_APP_ENVIRONMENT__) {
  window[`micro-app-${window.__MICRO_APP_NAME__}`] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount()
}
```

#### ** Angular **
以`angular11`为例。

```js
// main.ts
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

declare global {
  interface Window {
    microApp: any
    __MICRO_APP_NAME__: string
    __MICRO_APP_ENVIRONMENT__: string
  }
}

let app = null;
// 👇 将渲染操作放入 mount 函数
async function mount () {
  app = await platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err))
}

// 👇 将卸载操作放入 unmount 函数
function unmount () {
  app?.destroy();
  // 清空根元素，如果根元素不是app-root，根据实际情况调整
  document.querySelector('app-root').innerHTML = '';
  app = null;
}

// 微前端环境下，注册mount和unmount方法
if (window.__MICRO_APP_ENVIRONMENT__) {
  window[`micro-app-${window.__MICRO_APP_NAME__}`] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount();
}
```


#### ** Vite **
因为vite作为子应用时关闭了沙箱，导致`__MICRO_APP_ENVIRONMENT__`和`__MICRO_APP_NAME__`两个变量失效，所以需要自行判断是否微前端环境以及手动填写应用name值。

这里以 vue3 + vue-router4 为例：
```js
// main.js
import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import routes from './router'
import App from './App.vue'

let app = null
let router = null
let history = null
// 👇 将渲染操作放入 mount 函数
function mount () {
  history = VueRouter.createWebHashHistory(import.meta.env.BASE_URL)
  router = VueRouter.createRouter({
    history,
    routes,
  })

  app = createApp(App)
  app.use(router)
  app.mount('#app')
}

// 👇 将卸载操作放入 unmount 函数
function unmount () {
  app.unmount()
  history.destroy()
  app = null
  router = null
  history = null
}

// 微前端环境下，注册mount和unmount方法
if (如果是微前端环境) {
  // 应用的name值，即 <micro-app> 元素的name属性值
  window[`micro-app-${应用的name值}`] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount()
}
```
<!-- tabs:end -->

#### 自定义名称

通常注册函数的形式为 `window['micro-app-${window.__MICRO_APP_NAME__}'] = {}`，但也支持自定义名称，`window['自定义的名称'] = {}`

自定义的值需要在`<micro-app>`标签中通过`library`属性指定。

```html
<micro-app
  name='xxx'
  url='xxx'
  library='自定义的名称' 👈
></micro-app>
```

在沙箱关闭时`__MICRO_APP_NAME__`变量失效(如：vite子应用)，此时可以使用自定义名称的方式进行注册，也可以通过 `window['micro-app-${应用的name值}']`的方式注册。
