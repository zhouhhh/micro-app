import {useEffect} from 'react'
import microApp from '@micro-zoe/micro-app'
import config from '../../config'

function React17 () {
  function handleData (data) {
    console.log('来自react17的数据', data)
  }

  useEffect(() => {
    microApp.addDataListener('react17', handleData)
    return function clearup () {
      microApp.removeDataListener('react17', handleData)
      microApp.clearDataListener('react17')
    }
  }, [])

  return (
    <div style={{height: '100%'}}>
      <micro-app
        name='react17'
        url={`${config.react17}micro-app/react17`}
        data={{from: '来自基座的数据'}}
        // destory
        // inline
      />
    </div>
  )
}

export default React17
