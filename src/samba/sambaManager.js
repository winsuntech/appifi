let updateSambaFilesAsync = require('./updateSamba')
let DEFAULTDELAY = 500 // millisecond
let RETRYTIMES = 3

// stat/event    new request (file change)                 timeout                success                        fail
// init                                                                           idle                           exit
// idle          wait (current req)
// wait          wait (re-timer & req with next new req)   update (current req)    
// update        update (save new req as next req)                                next ? wait(next req) : idle   counter > 3 ? (next ? wait(next req) : idle) : counter + 1 & update (current req)
// exit

class State {
  constructor(contents) {
    this.contents = contents
  }

  setState(nextState, ...args) {
    this.contents.state = new nextState(this.contents, ...args)
  }
}

class Idle extends State{
  constructor(contents, data) {
    super(contents)
    this.enter()
  }

  resetSamba(data) {
    this.exit()
    this.setState(Wait, data)
  }

  enter() {
    // console.log('Enter Update')
  }

  exit() {
    // console.log('Leave Update')
  }
}

class Wait extends State {
  constructor(contents, data) {
    super(contents)
    this.enter()
    this.resetSamba(data)
  }

  resetSamba(data) {
    clearTimeout(this.timer)
    this.data = data
    this.timer = setTimeout(() => {
      this.exit()
      this.setState(Update, this.data) 
    }, this.contents.delay)
  }

  enter() {
    // console.log('Enter Wait')
  }

  exit() {
    // console.log('Leave Wait')
    clearTimeout(this.timer)
  }
}

class Update extends State {
  constructor(contents, data) { 
    super(contents)
    this.contents.counter = 0
    this.enter()
    updateSambaFilesAsync().then(() => {
      console.log(data)
      this.success()
      // this.error(err)
    }).catch(err => {
      console.log(err)
      this.error()
    })
  }

  resetSamba(data) {
    this.next = data
  }

  success() {
    if (this.next) {
      this.exit()
      this.setState(Wait, this.next)
    }
    else {
      this.exit()
      this.setState(Idle)
    }
  }

  error() {
    this.contents.counter += 1
    if(this.contents.counter >= RETRYTIMES) {
      if (this.next) {
        this.exit()
        this.setState(Wait, this.next)
      }
      else {
        this.exit()
        this.setState(Idle)
      }
    }
    else {
      updateSambaFilesAsync().then(() => {
        console.log(data)
        this.success()
      }).catch(err => {
        console.log(err)
        console.log('retry... ...')
        this.error()
      })
    }
  }

  enter() {
    // console.log('Enter Update')
  }

  exit() {
    // console.log('Leave Update')
  }
}

class SambaManager {
  constructor(delay, echo) {
    this.delay = delay || DEFAULTDELAY
    this.state = new Idle(this) 
  }

  resetSamba(echo) {
    this.state.resetSamba(echo)
  }
}

module.exports = SambaManager