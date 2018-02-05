/**
abstract base class of state

@memberof XCopy
*/
class State {

  /**
  Create a new state object.
  Fires new state event.

  @param {object} ctx - the node (sub-task)
  @param {array} args - the rest arguments 
  */
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
    this.ctx.emit(this.getState())
  }

  /**
  Destroy all state-specific resource
  */
  destroy () {
    console.log('1111122222333333==========')
    this.exit()
  }

  /**
  Returns state name
  */
  getState () {
    return this.constructor.name
  }

  /**
  Go to new state

  @param {string} state - next state name
  @param {array} args - the rest arguments
  */
  setState (state, ...args) {
    this.exit()
    let NextState = this.ctx[state]
    new NextState(this.ctx, ...args)
  }

  /**
  Enter state
  */
  enter () {
  }

  /**
  Exit state
  */
  exit () {
  }

  /**
  External view
  */
  view () {
    return null
  }
}

module.exports = State


