import { combineReducers } from 'redux'

import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
import docker from './docker'
import storage from './storage'
import appstore from './appstore'
import server from './server'
import installed from './installed'
 
const reducer = combineReducers({
  themeColor,
  login,
  navigation,
  docker,
  storage,
  appstore,
  installed,
  server
})

export default reducer

