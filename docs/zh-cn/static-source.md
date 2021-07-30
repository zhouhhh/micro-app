### 资源地址自动补全

是指对子应用相对路径的资源地址进行补全，以确保所有资源正常加载，它是`micro-app`默认提供的功能。

如：子应用中引用图片`/myapp/test.png`，在最终渲染时会补全为`http://localhost:8080/myapp/test.png`

资源地址补全分为两个方面：

**1、针对资源标签**

如 `link、script、img、a`

**2、针对css的远程资源**

如 `background-image、@font-face`

资源地址补全功能和沙箱、样式隔离绑定，当这两个功能被关闭时会受到影响。

当关闭样式隔离时，针对css的远程资源会失效，当关闭沙盒时，所有资源地址补全功能都将失效。


### 手动补全
如果自动补全功能失效时，可以采用手动补全作为兜底方案。

**步骤1:** 在`子应用`src目录下创建名称为`public-path.js`的文件，并添加如下内容
```js
if (window.__MICRO_APP_ENVIRONMENT__) {
  __webpack_public_path__ = window.__MICRO_APP_PUBLIC_PATH__
}
```

**步骤2:** 在子应用的入口文件的`最顶部`引入`public-path.js`
```js
import './public-path'
...
```

更多详细配置请查看webpack文档 [public-path](https://webpack.docschina.org/guides/public-path/#on-the-fly)
