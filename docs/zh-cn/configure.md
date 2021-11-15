通过配置项，我们可以决定开启或关闭某些功能。

## name
- Desc: `应用名称`
- Type: `string`
- Default: `必传参数`
- 使用方式: `<micro-app name='xx'></micro-app>`
- 注意事项: 必须以字母开头，且不可以带有除中划线和下划线外的特殊符号

每个`name`都对应一个应用，当多个应用同时渲染时，name不可以重复。

当`name`的值发生变化时，会卸载当前应用并重新渲染。

## url
- Desc: `应用地址`
- Type: `string`
- Default: `必传参数`
- 使用方式: `<micro-app name='xx' url='xx'></micro-app>`

基座应用和子应用本质是在同一个页面，这里的`url`只是html地址，子应用的路由还是基于浏览器地址。

当`url`的值发生变化时，会卸载当前应用并根据新的`url`值重新渲染。

## baseroute
- Desc: `子应用的基础路由`
- Type: `string`
- Default: `''`
- 使用方式: `<micro-app name='xx' url='xx' baseroute='/my-page/'></micro-app>`

在微前端环境下，子应用可以从window上获取baseroute的值，用于设置基础路由。

以react-router为例，在子应用的路由中配置`basename`：
```js
<BrowserRouter basename={window.__MICRO_APP_BASE_ROUTE__ || '/'}>
  <Switch>
    ...
  </Switch>
</BrowserRouter>
```

## inline
- Desc: `是否使用内联script`
- Default: `false`
- 使用方式: `<micro-app name='xx' url='xx' inline></micro-app>`

默认情况下，子应用的js会被提取并在后台运行。

开启inline后，被提取的js会作为script标签插入应用中运行，在开发环境中更方便调试。

> [!TIP]
> 开启inline后会稍微损耗性能，一般在开发环境中使用。

## destory
- Desc: `卸载时是否强制删除缓存资源`
- Default: `false`
- 使用方式: `<micro-app name='xx' url='xx' destory></micro-app>`

默认情况下，子应用被卸载后会缓存静态资源，以便在重新渲染时获得更好的性能。

开启destory，子应用在卸载后会清空缓存资源，再次渲染时重新请求数据。

## disableScopecss
- Desc: `禁用样式隔离`
- Default: `false`
- 使用方式: `<micro-app name='xx' url='xx' disableScopecss></micro-app>`

在禁用样式隔离前，请确保基座应用和子应用，以及子应用之间样式不会相互污染。

> [!NOTE]
> 禁用样式隔离，CSS中的资源地址补全功能失效，需要设置[publicpath](/zh-cn/static-source?id=publicpath)防止资源加载失败。

## disableSandbox
- Desc: `禁用js沙箱`
- Default: `false`
- 使用方式: `<micro-app name='xx' url='xx' disableSandbox></micro-app>`

禁用沙箱可能会导致一些不可预料的问题，通常情况不建议这样做。

> [!NOTE]
> 禁用沙箱后以下功能将失效:
> 
> 1、样式隔离
>
> 2、元素隔离
>
> 3、静态资源地址补全
>
> 4、`__MICRO_APP_ENVIRONMENT__`、`__MICRO_APP_PUBLIC_PATH__`等全局变量
>
> 5、baseroute


## shadowDOM
- Desc: `是否开启shadowDOM`
- Type: `string(boolean)`
- Default: `false`
- 使用方式: `<micro-app name='xx' url='xx' shadowDOM></micro-app>`

shadowDOM具有更强的样式隔离能力，开启后，`<micro-app>`标签会成为一个真正的WebComponent。

但shadowDOM在React框架及一些UI库中的兼容不是很好，请谨慎使用。

## 全局配置
全局配置会影响每一个子应用，上述几个选项都可以配置到全局。

**使用方式**

只在入口文件定义一次，不要多次定义。
```js
import microApp from '@micro-zoe/micro-app'

microApp.start({
  inline: true, // 默认值false
  destory: true, // 默认值false
  disableScopecss: true, // 默认值false
  disableSandbox: true, // 默认值false
  shadowDOM: true, // 默认值false
})
```

如果希望在某个应用中不使用全局配置，可以单独配置关闭：
```html
<micro-app 
  name='xx' 
  url='xx' 
  inline='false'
  destory='false'
  disableScopecss='false'
  disableSandbox='false'
  shadowDOM='false'
></micro-app>
```

## 其它配置
### global
当多个子应用使用相同的js或css资源，在link、script设置`global`属性会将文件提取为公共文件，共享给其它应用。

设置`global`属性后文件第一次加载会放入公共缓存，其它子应用加载相同的资源时直接从缓存中读取内容，从而提升渲染速度。

**使用方式**
```html
<link rel="stylesheet" href="xx.css" global>
<script src="xx.js" global></script>
```

### globalAssets
globalAssets用于设置全局共享资源，它和预加载的思路相同，在浏览器空闲时加载资源并放入缓存，提高渲染效率。

当子应用加载相同地址的js或css资源时，会直接从缓存中提取数据，从而提升渲染速度。

**使用方式**
```js
// index.js
import microApp from '@micro-zoe/micro-app'

microApp.start({
  globalAssets: {
    js: ['js地址1', 'js地址2', ...], // js地址
    css: ['css地址1', 'css地址2', ...], // css地址
  }
})
```

### exclude(过滤元素)
当子应用不需要加载某个js或css，可以通过在link、script、style设置exclude属性，当micro-app遇到带有exclude属性的元素会进行删除。

**使用方式**
```html
<link rel="stylesheet" href="xx.css" exclude>
<script src="xx.js" exclude></script>
<style exclude></style>
```

### ignore(忽略元素)
当link、script、style元素具有ignore属性，micro-app不会处理它，元素将原封不动进行渲染。

使用场景例如：jsonp

jsonp会创建一个script元素加载数据，正常情况script会被拦截导致jsonp请求失败，此时可以给script元素添加ignore属性，跳过拦截。

```js
// 修改jsonp方法，在创建script元素后添加ignore属性
const script = document.createElement('script')
script.setAttribute('ignore', 'true')
...
```
