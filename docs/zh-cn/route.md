微前端的渲染离不开路由，所以需要说明一下路由配置的注意点和常会遇到的问题。

### url属性和子应用路由的关系
答：没有关系！

micro-app的url属性指向html的地址，它只是用来获取html，不会对子应用产生影响。

基座应用和子应用本质是在同一个页面渲染，所以影响到子应用路由的是浏览器地址。

举个栗子🌰 :

浏览器地址为：`http://localhost:3000/page1/`，此时路由地址为`page1`。

基座应用会匹配`page1`并渲染对应的组件，子应用也是一样，浏览器地址会同时影响到基座应用和子应用，因为每个应用都有一套自己的路由系统，它们是可以共存的，不会冲突。

此时我们要渲染子应用`http://www.xxx.com/`的`page1`页面，那么url属性填写的不是`http://www.xxx.com/page1/`，而是`http://www.xxx.com/`。

```html
// http://www.xxx.com/ 会兜底到 http://www.xxx.com/index.html
<micro-app url='http://www.xxx.com/'></micro-app>
```
子应用加载完成后会根据浏览器的地址`page1`匹配到对应的组件并渲染，最终效果和访问`http://www.xxx.com/page1/`一致。

### 路由配置

如果子应用是单页面应用，那么不需要关心路由的问题。

如果是子应用多页面，需要正确配置路由，否则容易出错，以下是需要注意的点：

- 1、基座是hash路由，子应用也必须是hash路由
- 2、基座是history路由，子应用可以是hash或history路由
- 3、基座路由匹配的path不能使用严格匹配
- 4、子应用根据基座路由分配的path添加路由前缀
- 5、如果基座是history路由，子应用是hash路由，不需要设置路由前缀

**示例**

**React**

<!-- tabs:start -->

#### ** 基座 **

```js
// router.js
import { BrowserRouter, Switch, Route } from 'react-router-dom'
import ChildPage from './child-page'

export default function AppRoute () {
  return (
    <BrowserRouter>
      <Switch>
        // 非严格匹配，/child/* 都将匹配到ChildPage组件
        <Route path='/child'>
          <ChildPage />
        </Route>
        ...
      </Switch>
    </BrowserRouter>
  )
}

// child-page.js
export function ChildPage () {
  return (
    <div>
      <h1>子应用</h1>
      <micro-app name='child-app' url='http://localhost:3000/' baseurl='/child'></micro-app>
    </div>
  )
}
```

#### ** 子应用 **
```js
import { BrowserRouter, Switch, Route } from 'react-router-dom'

export default function AppRoute () {
  return (
    // 添加路由前缀basename
    <BrowserRouter basename={window.__MICRO_APP_BASE_URL__ || '/'}>
      <Switch>
        ...
      </Switch>
    </BrowserRouter>
  )
}
```
<!-- tabs:end -->

**Vue**

<!-- tabs:start -->

#### ** 基座 **

```js
// router.js
import Vue from 'vue'
import VueRouter from 'vue-router'
import ChildPage from './child-page.vue'

Vue.use(VueRouter)

const routes = [
  {
    // /child/* 都将匹配到ChildPage组件
    path: '/child/*', 
    name: 'child',
    component: ChildPage,
  },
]

export default routes

// child-page.vue
<template>
  <div>
    <h1>子应用</h1>
    <micro-app name='child-app' url='http://localhost:3000/' baseurl='/child'></micro-app>
  </div>
</template>

<script>
export default {
  name: 'ChildPage',
}
</script>
```

#### ** 子应用 **
```js
import Vue from 'vue'
import VueRouter from 'vue-router'
import routes from './router'

const router = new VueRouter({
  options: {
    base: window.__MICRO_APP_BASE_URL__ || '/',
  },
  routes,
})

let app = new Vue({
  router,
  render: h => h(App),
}).$mount('#app')
```
<!-- tabs:end -->

> [!TIP]
> vue-router@4设置baseURL的方式请查看 https://next.router.vuejs.org/


### 应用之间如何跳转
因为每个应用的路由实例都是不同的，路由实例只能控制自身，无法影响其它应用，要实现应用之间的跳转有两种方式：

### 1、history.pushState(replaceState)
[history.pushState](https://developer.mozilla.org/zh-CN/docs/Web/API/History/pushState)和[history.replaceState](https://developer.mozilla.org/zh-CN/docs/Web/API/History/replaceState)可以直接修改浏览器地址，但是它们无法触发`popstate`事件，所以在跳转后需要主动触发一次`popstate`事件。

例如：
```js
history.pushState(null, null, 'page2')

// 主动触发一次popstate事件
window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
```

对于hash路由也同样适用
```js
history.pushState(null, null, '#/page2')

// 主动触发一次popstate事件
window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
```

### 2、数据通信进行控制
如基座下发指令控制子应用进行跳转，或者子应用向基座应用上传一个可以控制自身路由的函数。
