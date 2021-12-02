
## 1、preFetch
**描述：应用预加载**

**介绍：**
```js
preFetch([
  {
    name: string,
    url: string,
    disableScopecss?: boolean,
    disableSandbox?: boolean,
  },
])
```

**使用方式：**
```js
import { preFetch } from '@micro-zoe/micro-app'

// 方式一
preFetch([
  { name: 'my-app', url: 'xxx' },
])

// 方式二
preFetch(() => [
  { name: 'my-app', url: 'xxx' },
])
```


## 2、getActiveApps
**描述：获取正在运行的子应用，不包含已卸载和预加载的应用**

**版本限制：** 0.5.2及以上版本

**介绍：**
```js
function getActiveApps(): string[]
```

**使用方式：**
```js
import { getActiveApps } from '@micro-zoe/micro-app'

getActiveApps() // [子应用name, 子应用name, ...]
```

## 3、getAllApps
**描述：获取所有子应用，包含已卸载和预加载的应用**

**版本限制：** 0.5.2及以上版本

**介绍：**
```js
function getAllApps(): string[]
```

**使用方式：**
```js
import { getAllApps } from '@micro-zoe/micro-app'

getAllApps() // [子应用name, 子应用name, ...]
```



## 4、version
**描述：查看版本号**

**方式1：**
```js
import { version } from '@micro-zoe/micro-app'
```

**方式2：**通过micro-app元素上的version属性查看
```js
document.querySelector('micro-app').version
```


## 5、removeDomScope
**描述：解除元素绑定**

**使用方式：**
```js
import { removeDomScope } from '@micro-zoe/micro-app'

// 重置作用域
removeDomScope()
```


## 6、pureCreateElement
**描述：创建无绑定的纯净元素**

**使用方式：**
```js
import { pureCreateElement } from '@micro-zoe/micro-app'

const divElement = pureCreateElement('div')
```

## 7、EventCenterForMicroApp
**描述：创建子应用通信对象，用于沙箱关闭时(如：vite)与子应用进行通信**

**使用方式：**
```js
import { EventCenterForMicroApp } from '@micro-zoe/micro-app'

// 每个子应用根据appName单独分配一个通信对象
window.eventCenterForAppName = new EventCenterForMicroApp(appName)
```

详情查看：[关闭沙箱后的通信方式](/zh-cn/data?id=关闭沙箱后的通信方式)
