/** @jsxRuntime classic */
/** @jsx jsxCustomEvent */
import jsxCustomEvent from '@micro-zoe/micro-app/polyfill/jsx-custom-event'
import 'zone.js'
import { useState } from 'react'
import { Spin } from 'antd'
import config from '../../config'

function Angular11 () {
  const [showLoading, hideLoading] = useState(true)
  const [data, changeData] = useState({frotm: '来自基座的初始化数据'})

  return (
    <div>
      {
        showLoading && <Spin />
      }
      <micro-app
        name='angular11'
        url={`${config.angular11}micro-app/angular11`}
        data={data}
        onMounted={() => hideLoading(false)}
        baseurl='/micro-app/demo/angular11'
        // destory
        // inline
        // disableScopecss
      >
      </micro-app>
    </div>
  )
}

export default Angular11
