路由不属于`MicroApp`的范围，但微前端的渲染离不开路由，所以需要说明一下路由配置的注意点和常会遇到的问题。

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



### 子应用之间如何跳转
因为每个应用的路由实例都是不同的，每个应用只能在自己的`baseurl`之内跳转。

跨应用跳转时推荐使用 [history.pushState](https://developer.mozilla.org/zh-CN/docs/Web/API/History/pushState) 进行跳转。

也可以通过数据通信进行控制。
