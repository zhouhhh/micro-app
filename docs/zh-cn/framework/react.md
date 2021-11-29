本篇以react16、17作为案例介绍react的接入方式，其它版本react的接入方式以此类推。我们默认开发者掌握了各版本react的开发技巧，如示例中的 useEffect，在不支持hooks的版本中需要转换为 componentDidMount

### 基座应用
我们强烈建议基座应用采用history模式，hash路由的基座应用只能加载hash路由的子应用，history模式的基座应用对这两种子应用都支持。

在以下案例中，我们默认基座的路由为history模式。

**1、安装依赖**
```bash
npm i @micro-zoe/micro-app --save
```

**2、在入口处引入**
```js
// index.js
import microApp from '@micro-zoe/micro-app'

microApp.start()
```

**3、分配一个路由给子应用**

```js
// router.js
import { BrowserRouter, Switch, Route } from 'react-router-dom'
import MyPage from './my-page'

export default function AppRoute () {
  return (
    <BrowserRouter>
      <Switch>
        // 👇👇 非严格匹配，/my-page/* 都将匹配到 MyPage 页面
        <Route path='/my-page'>
          <MyPage />
        </Route>
        ...
      </Switch>
    </BrowserRouter>
  )
}
```

**4、在页面中嵌入微前端应用**

由于React不支持自定义事件，我们需要在`<micro-app>`标签所在的文件顶部引入一个polyfill。

注意：*jsx-custom-event 上面两行注释也要复制*

```js
/** @jsxRuntime classic */
/** @jsx jsxCustomEvent */
import jsxCustomEvent from '@micro-zoe/micro-app/polyfill/jsx-custom-event'

export function MyPage () {
  return (
    <div>
      <h1>子应用</h1>
      // name(必传)：应用名称
      // url(必传)：应用地址
      // baseroute(可选)：基座应用分配给子应用的基础路由，就是上面的 `/my-page`
      <micro-app name='app1' url='http://localhost:3000/' baseroute='/my-page'></micro-app>
    </div>
  )
}
```

### 子应用
