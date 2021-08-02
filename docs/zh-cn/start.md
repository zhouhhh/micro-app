> [!TIP]
> 在开始使用之前，需要确保子应用的静态资源可以跨域访问，跨域配置参考[这里](/zh-cn/questions?id=_2、子应用静态资源一定要支持跨域吗？)

我们分别列出基座应用和子应用需要进行的修改，具体介绍`micro-app`的使用方式。

`下述以react代码为例`

#### 基座应用
1、安装依赖
```bash
npm i @micro-zoe/micro-app --save
```

2、在入口处引入依赖
```js
// index.js
import microApp from '@micro-zoe/micro-app'

microApp.start()
```

3、分配一个路由给子应用
```js
import { BrowserRouter, Switch, Route } from 'react-router-dom'
import MyPage from './my-page'

export default function AppRoute () {
  return (
    <BrowserRouter>
      <Switch>
        // 👇 非严格匹配，/my-page/* 都将匹配到 MyPage 组件
        <Route path='/my-page'>
          <MyPage />
        </Route>
        ...
      </Switch>
    </BrowserRouter>
  )
}
```

4、在页面中使用组件
```js
// my-page.js
export function MyPage () {
  return (
    <div>
      <h1>加载子应用</h1>
      /**
       * micro-app为自定义标签，可以在任何地方使用
       * url为html地址 (基座应用和子应用本质是在同一个页面，这里的url只是html地址，子应用的路由还是基于浏览器地址的)
       */
      <micro-app name='app1' url='http://localhost:3000/' baseurl='/my-page'></micro-app>
    </div>
  )
}
```

> [!NOTE]
> 1、`name`和`url`属性必传，`name`值不可以重复。
>
> 2、`url`属性和子应用路由的关系请查看[这里](/zh-cn/route)
>
> 3、`baseurl`是基座应用分配给子应用的路由前缀，非必传，默认值为空字符串。

#### 子应用
添加路由前缀

```js
import { BrowserRouter, Switch, Route } from 'react-router-dom'

export default function AppRoute () {
  return (
    // 👇 添加路由前缀，子应用可以通过window.__MICRO_APP_BASE_URL__获取基座下发的baseurl
    <BrowserRouter basename={window.__MICRO_APP_BASE_URL__ || '/'}>
      <Switch>
        ...
      </Switch>
    </BrowserRouter>
  )
}
```
