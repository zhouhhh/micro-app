<p align="center">
  <a href="https://cangdu.org/micro-app/">
    <img src="https://cangdu.org/micro-app/_media/logo.png" alt="logo" width="180" />
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@micro-zoe/micro-app"><img src="https://img.shields.io/npm/v/@micro-zoe/micro-app.svg?style=flat-square" alt="version" /></a>
  <a href="https://www.npmjs.com/package/@micro-zoe/micro-app"><img src="https://img.shields.io/npm/dt/@micro-zoe/micro-app.svg?style=flat-square" alt="downloads" /></a>
  <a href="https://www.npmjs.com/package/@micro-zoe/micro-app"><img src="https://img.shields.io/npm/l/@micro-zoe/micro-app.svg?style=flat-square" alt="license" /></a>
  <a href="https://codecov.io/gh/micro-zoe/micro-app"><img src="https://img.shields.io/codecov/c/github/micro-zoe/micro-app.svg?style=flat-square" alt="test:coverage" /></a>
  <a href="https://travis-ci.com/micro-zoe/micro-app"><img src="https://img.shields.io/travis/micro-zoe/micro-app.svg?style=flat-square" alt="travis" /></a>
  <!-- https://img.shields.io/travis/micro-zoe/micro-app.svg?style=flat-square -->
</p>

# 简介
Micro App 不再以监听url的变化来渲染微前端，而是借鉴了WebComponent的思想，通过CustomElement结合自定义的ShadowDom，将所有功能都封装到一个类WebComponent组件中，从而实现微前端的组件化渲染，并且由于自定义ShadowDom的隔离特性，Micro App不需要子应用做过多的修改，这是目前市面上接入成本最低的微前端框架。

# 特性
Micro App不仅使用简单，还提供了 JS沙箱、样式隔离、元素隔离、数据通信、预加载 等一系列完善的功能。

##### 概念图
![image](https://img10.360buyimg.com/imagetools/jfs/t1/168885/23/20790/54203/6084d445E0c9ec00e/d879637b4bb34253.png ':size=750')

# 开始使用
微前端分为基座应用和子应用，我们分别列出基座应用和子应用需要进行的修改，具体介绍Micro App的使用方式。

`下述以react代码为例`

### 基座应用
1、安装依赖
```bash
yarn add @micro-zoe/micro-app
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
      // 👇 micro-app为自定义标签，可以在任何地方使用
      <micro-app name='app1' url='http://localhost:3000/' baseurl='/my-page'></micro-app>
    </div>
  )
}
```

### 子应用
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
以上即完成了微前端的渲染。

**注意**: 子应用的静态资源需要支持跨域访问。


# 本地开发
1、下载项目
```
git clone https://github.com/micro-zoe/micro-app.git
```

2、安装依赖
```
yarn bootstrap
```

3、运行项目
```
yarn start # 访问 http://localhost:3000
```

默认启动react基座应用，如果想启动vue基座应用，可以运行`yarn start:main-vue2`

# FAQ
https://cangdu.org/micro-app/docs.html#/zh-cn/questions

# License
MIT
