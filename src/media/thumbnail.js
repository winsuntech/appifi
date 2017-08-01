const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child')
const crypto = require('crypto')
const UUID = require('uuid')

const threadify = require('../lib/threadify')

/**
Thumbnail is a component.

It uses `<fruitmix root>/thumbnail` as the cache directory.

query string: width, height, modifier, autoOrient

file name: digest (now fingerprint) + optionHash 

@module thumbnail
*/

import models from '../models/models'
import paths from './paths'

const ERROR = (code, _text) => text => Object.assign(new Error(text || _text), { code })

const EFAIL = ERROR('EFAIL', 'operation failed')
const EINVAL = ERROR('EINVAL', 'invalid argument')
const EINTR = ERROR('EINTR', 'operation interrupted')
const ENOENT = ERROR('ENOENT', 'entry not found')

// courtesy https://stackoverflow.com/questions/5467129/sort-javascript-object-by-key for letting me know the comma operator
const sortObject = o => Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {})

// hash stringified option object
const genKey = (digest, opts) => digest + crypto.createHash('sha256').update(JSON.stringify(sortObject(opts))).digest('hex')

// generate geometry string for convert
const geometry = (width, height, modifier) => {
  let str

  if (!height) { str = `${width.toString()}` } else if (!width) { str = `x${height.toString()}` } else {
    str = `${width.toString()}x${height.toString()}`

    switch (modifier) {
      case 'caret':
        str += '^'
        break
      default:
        break
    }
  }
  return str
}

// parse query to opts
const parseQuery = query => {
  let { width, height, modifier, autoOrient } = query

  if (width !== undefined) {
    width = parseInt(width)
    if (!Number.isInteger(width) || width === 0 || width > 4096) { return EINVAL('invalid width') }
  }

  if (height !== undefined) {
    height = parseInt(height)
    if (!Number.isInteger(height) || height === 0 || height > 4096) { return EINVAL('invalid height') }
  }

  if (!width && !height) return EINVAL('no geometry')

  if (!width || !height) modifier = undefined
  if (modifier && modifier !== 'caret') return EINVAL('unknown modifier')

  if (autoOrient !== undefined) {
    if (autoOrient !== 'true') { return EINVAL('invalid autoOrient') }
    autoOrient = true
  }

  return { width, height, modifier, autoOrient }
}

// convert, return abort function
const convert = (src, tmp, dst, opts, callback) => {
  let finished = false

  let args = []
  args.push(src)
  if (opts.autoOrient) args.push('-auto-orient')
  args.push('-thumbnail')
  args.push(geometry(opts.width, opts.height, opts.modifier))
  args.push(tmp)

  let spawn = child.spawn('convert', args)
    .on('error', err => CALLBACK(err))
    .on('close', code => {
      spawn = null
      if (finished) return
      if (code !== 0) {
        CALLBACK(EFAIL(`convert spawn failed with exit code ${code}`))
      } else {
        fs.rename(tmp, dst, CALLBACK)
      }
    })

  function CALLBACK (err) {
    if (finished) return
    if (spawn) spawn = spawn.kill()
    finished = true
    callback(err)
  }

  return () => CALLBACK(EINTR())
}


class Converter extends threadify(EventEmitter) {

  constructor() {
    
  }

  run () {
       
  }
}

class Thumbnail {

  constructor() {
    this.limit = 1
    this.jobs = []
  }

  request (digest, query, callback) {
  } 
}

const createThumbnailer = () => {
  let limit = 1
  let jobs = []

  // create a job, using function scope as context / object
  function createJob (key, digest, opts) {
    let intr
    let listeners = []
    let dst = path.join(paths.get('thumbnail'), key)

    function run () {
      const src = models.getModel('filer').readMediaPath(digest)
      if (!src) return finish(ENOENT('src not found'))
      const tmp = path.join(paths.get('tmp'), UUID.v4())
      intr = convert(src, tmp, dst, opts, finish)
    }

    function finish (err) {
      listeners.forEach(cb => err ? cb(err) : cb(null, dst))
      intr = undefined
      jobs.splice(jobs.findIndex(j => j.key === key), 1)
      schedule()
    }

    return {
      key,
      run,
      isRunning: () => !!intr,
      addListener: (listener) => listeners.push(listener),
      abort: () => intr && (intr = intr())
    }
  }

  function schedule () {
    let diff = limit - jobs.filter(job => job.isRunning()).length
    if (diff <= 0) return

    jobs.filter(job => !job.isRunning())
      .slice(0, diff)
      .forEach(job => job.run())
  }

  function generate (key, digest, opts) {
    let job = jobs.find(j => j.key === key)
    if (job) return job

    job = createJob(key, digest, opts)
    jobs.push(job)
    if (jobs.filter(job => job.isRunning()).length < limit) job.run()
    return job
  }

  function abort () {
    jobs.filter(job => job.isRunning())
      .forEach(job => job.abort())
    jobs = []
  }

  function request (digest, query, callback) {
    let opts = parseQuery(query)
    if (opts instanceof Error) { return process.nextTick(callback, opts) }

    let key = genKey(digest, opts)
    let thumbpath = path.join(paths.get('thumbnail'), key)

    // find the thumbnail file first
    fs.stat(thumbpath, (err, stat) => {
      // if existing, return path for instant, or status ready for pending
      if (!err) return callback(null, thumbpath)

      // if error other than ENOENT, return err
      if (err.code !== 'ENOENT') return callback(err)

      // request a job to generate thumbnail
      let job = generate(key, digest, opts)

      if (query.nonblock === 'true') {
        if (job.isRunning()) {
          callback({ status: 'running' })
        } else {
          callback({ status: 'pending' })
        }
      } else {
        if (job.isRunning()) {
          job.addListener(callback)
        } else {
          callback({ status: 'pending' })
        }
      }
    })
  }

  return { request, abort }
}

module.exports = createThumbnailer


