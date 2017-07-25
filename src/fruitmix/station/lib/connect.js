const fs = require('fs')
const path = require('path')
const debug = require('debug')('station')

const client = require('socket.io-client')
const ursa = require('ursa')

const { FILE, CONFIG } = require('./const')
const broadcast = require('../../../common/broadcast')


const CONNECT_STATE = {
  DISCED: 'DISCONNECTED',
  DISCING: 'DISCONNECT_ING',
  CONNED: 'CONNECTED',
  CONNING: 'CONNECT_ING'
}

Object.freeze(CONNECT_STATE)

class Connect { 

  constructor() {
    this.initialized = false
    this.state = CONNECT_STATE.DISCED
    broadcast.on('StationStart', station => {
      this.sa = station.sa
      this.froot = station.froot
      this.privateKey = station.privateKey
      this._connect(CONFIG.CLOUD_PATH)
    })
    broadcast.on('StationStop', () => this.deinit())
  }

  _changeState(state, error) {
    if(state === CONNECT_STATE.DIS && error)
      this.error = error
    else
      this.error = null
    this.state = state
  }

  deinit(){
    this.disconnect()
    this.error = null
    this.froot = null
    this.state = CONNECT_STATE.DISCED
    this.sa = null
    this.socket = null
    this.privateKey = null
    this.token = null
    this.initialized = false
    debug('connect deinit')
  }

  _connect(address) {
    // console.log(this.state)
    // console.log(this.socket)
    if(this.socket && this.socket.connected) throw new　Error('Connent is connected now')
    if(this.socket && this.socket.disconnected){
      this._changeState(CONNECT_STATE.CONNING)
      return this.socket.connect()
    }
      
    this.socket = client(address,{
      transports: ['websocket']
    })
    this._changeState(CONNECT_STATE.CONNING)
    this.socket.on('connect', (() => {
      this._changeState(CONNECT_STATE.CONNING)
      debug('connent success')
      if(this.socket)
        this.send('requestLogin',{ id: this.sa.id})
    }).bind(this))
    this.socket.on('event', ((data) => {
      this.dispatch(data.type, data)
    }).bind(this))
    this.socket.on('message', ((data) => {
      this.dispatch(data.type, data.data)
    }).bind(this))
    this.socket.on('disconnect', data => {
      this._changeState(CONNECT_STATE.DISCED)
      debug('connent disconnect', data)
    })
    this.socket.on('error', err => {
      debug(err)
    })
    this.socket.on('connect_error', err => {
      this._changeState(CONNECT_STATE.DISCED, err)
    })
    this.initialized = true
    debug('connect init')
  }

  dispatch(eventType, data) {
    debug('dispatch:', eventType, data)
    if(eventType === 'checkLogin'){
      let secretKey = ursa.createPrivateKey(this.privateKey)
      let seed
      try{
        seed = secretKey.decrypt(data.encryptData, 'base64', 'utf8')
        this.send('login', { seed })
      }catch(e){
        //TODO:
        debug(e)
      }
    }
    if(eventType === 'login'){
      let success = data.success
      //TODO: token
      if(success){
        this.token = data.token
        this._changeState(CONNECT_STATE.CONNED)
      }else
        this.disconnect()
      debug(success)
    }
  }

  send(eventType, data) {
    debug(eventType, data)
    this.socket.emit('message', { type: eventType, data})
  }

  disconnect() {
    if(this.state !== CONNECT_STATE.DISCED){
      if(this.socket && this.socket.connected) {
        this._changeState(CONNECT_STATE.DISCING)
        this.socket.disconnect()
        this.socket = null
      } 
    }
  }

  connect() {
    if(this.state === CONNECT_STATE.DISCED)
      this._connect(CONFIG.CLOUD_PATH)
  }

  getState(){
    return this.state
  }

  isConnect() {
    if(this.socket && this.socket.connected)
      return true
    return false
  }
}

module.exports = new Connect()
