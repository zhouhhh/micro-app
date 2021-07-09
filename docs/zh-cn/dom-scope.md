元素隔离是指子应用的元素是和自己绑定，元素不会逃离`<micro-app>`元素边界，子应用对元素的增、删、改、查都在`<micro-app>`元素内部执行。

比如基座应用和子应用的根元素都为`<div id='root'></div>`，元素隔离可以确保子应用通过`document.querySelector('#root')`获取到的是自己的根元素。

### 主动解除元素隔离
正常情况下，元素隔离解绑是自动的以异步执行，但异步可能会导致基座应用渲染出错，我们可以主动解除元素绑定来避免这个问题。

```js
import { removeDomScope } from '@micro-zoe/micro-app'

// 解除元素绑定
removeDomScope()
```
