import fs from 'fs'
import child from 'child_process'
import xattr from 'fs-xattr'
import UUID from 'node-uuid'
import validator from 'validator'

Promise.promisifyAll(fs)
Promise.promisifyAll(xattr)

// constants
const FRUITMIX = 'user.fruitmix'

// bump version when more file type supported
const UNINTERESTED_MAGIC_VERSION = 0
const parseMagic = text => text.startsWith('JPEG image data') ? 'JPEG' : UNINTERESTED_MAGIC_VERSION

const EInvalid = (text) => 
  Object.assign((new Error(text || 'invalid args')), { code: 'EINVAL' })

const InstanceMismatch = (text) => 
  Object.assign((new Error(text || 'instance mismatch')), { code: 'EMISMATCH' })

const TimestampMismatch = (text) =>
  Object.assign((new Error(text || 'timestamp mismatch')), { code: 'EOUTDATED' })

// test uuid, return true or false, accept undefined
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false

// validate hash
const isSHA256 = (hash) => /[a-f0-9]{64}/.test(hash)

// it's fast, child.exec is sufficient
const fileMagic = (target, callback) => 
  child.exec(`file -b ${target}`, (err, stdout, stderr) =>
    err ? callback(err) : callback(null, parseMagic(stdout.toString())))

const fileMagicAsync = Promise.promisify(fileMagic)

const readTimeStamp = (target, callback) =>
  fs.lstat(target, (err, stats) => 
    err ? callback(err) : callback(null, stats.mtime.getTime()))

// de-duplication
const nonRepeatArr = (arr) => { return Array.from(new Set(arr)) }

// clear arr2, make sure arr2 only contains elements that don't exist in arr1
const  duplicateArr = (arr1, arr2) => {
  let temp = []
  let tempArr = []

  // take the content of arr1 as key, true as value
  for(let i = 0; i < arr1.length; i++) { temp[arr1[i]] = true }
  // take the content of arr2 as key, if false, this is a non-repeat value
  for(let i = 0; i < arr2.length; i++) {
    if(!temp[arr2[i]]) tempArr.push(arr2[i])
  }
  return tempArr
}

// this function throw SyntaxError if given attr is bad formatted
const validateOldFormat = (attr, isFile) => {

  if (typeof attr.uuid === 'string' && validator.isUUID(attr.uuid)) {}
  else throw new SyntaxError('invalid uuid')

  if (Array.isArray(attr.owner) && attr.owner.every(uuid => isUUID(uuid))) {}
  else throw new SyntaxError('invalid owner')

  if (attr.writelist === undefined || (Array.isArray(attr.writelist) && attr.writelist.every(uuid => isUUID(uuid)))) {}
  else throw new SyntaxError('invalid writelist')

  if (attr.readlist === undefined || (Array.isArray(attr.readlist) && attr.readlist.every(uuid => isUUID(uuid)))) {}
  else throw new SyntaxError('invalid readlist')

  if (!!attr.writelist === !!attr.readlist) {}
  else throw new SyntaxError('writelist and readlist inconsistent')
 
  if (isFile) {

    if (attr.hasOwnProperty('hash') === attr.hasOwnProperty('htime')) {}
    else throw new SyntaxError('hash and htime inconsistent')
      
    if (attr.hasOwnProperty('hash')) {
      if (!isSHA256(attr.hash))
        throw new SyntaxError('invalid hash string')

      if (!Number.isInteger(attr.htime))
        throw new SyntaxError('invalid htime')
    } 

    if (attr.hasOwnProperty('magic')) {      
      if (typeof attr.magic !== 'string')
        throw new SyntaxError('invalid magic')
    }
  }
}

const validateNewFormat = (attr, isFile) => {

  if (typeof attr.uuid === 'string' && validator.isUUID(attr.uuid)) {}
  else throw new SyntaxError('invalid uuid')

  if (attr.writelist === undefined || (Array.isArray(attr.writelist) && attr.writelist.every(uuid => isUUID(uuid)))) {}
  else throw new SyntaxError('invalid writelist')

  if (attr.readlist === undefined || (Array.isArray(attr.readlist) && attr.readlist.every(uuid => isUUID(uuid)))) {}
  else throw new SyntaxError('invalid readlist')

  if (isFile) {

    if (attr.hasOwnProperty('hash') === attr.hasOwnProperty('htime')) {}
    else throw new SyntaxError('hash and htime inconsistent')
      
    if (attr.hasOwnProperty('hash')) {
      if (!isSHA256(attr.hash))
        throw new SyntaxError('invalid hash string')

      if (!Number.isInteger(attr.htime))
        throw new SyntaxError('invalid htime')
    } 

    if (attr.hasOwnProperty('magic')) {   
      if (typeof attr.magic === 'string' || Number.isInteger(attr.magic)) {}
      else throw new SyntaxError('invalid magic')
    } else {
      throw new SyntaxError('magic absent')
    }
  }
}

// async version of readXstat, simpler to implement than callback version
const readXstatAsync = async target => {

  let dirty = false
  let attr, stats = await fs.lstatAsync(target)
  
  if (!stats.isDirectory() && !stats.isFile()) 
    throw Object.assign(new Error('not a directory or file'), { code: 'ENOTDIRORFILE' })

  try {

    attr = JSON.parse(await xattr.getAsync(target, FRUITMIX))

    if (attr.hasOwnProperty('owner')) {
      validateOldFormat(attr, stats.isFile()) 

      dirty = true
      delete attr.owner
      if (attr.writelist === null) delete attr.writelist
      if (attr.readlist === null) delete attr.readlist
      if (stats.isFile()) 
        attr.magic = attr.magic ? parseMagic(attr.magic) : await fileMagicAsync(target)
    }
    else
      validateNewFormat(attr, stats.isFile())
      if(Number.isInteger(attr.magic) && attr.magic < UNINTERESTED_MAGIC_VERSION){
        magic = fileMagicAsync(target);
      }

    // drop hash if outdated
    if (stats.isFile() && attr.htime && attr.htime !== stats.mtime.getTime()) {
      dirty = true
      delete attr.hash
      delete attr.htime
    } 
  }
  catch (e) {
    // ENOENT
    if (e.code !== 'ENODATA' && !(e instanceof SyntaxError)) throw e 

    dirty = true
    attr = { uuid: UUID.v4() }
    if (stats.isFile()) attr.magic = await fileMagicAsync(target)
  }

  // save new attr if dirty
  if (dirty) await xattr.setAsync(target, FRUITMIX, JSON.stringify(attr)) 

  // remove props not passed to caller
  if (stats.isFile() && attr.htime) delete attr.htime
  if (stats.isFile() && typeof attr.magic === 'number') delete attr.magic

  return Object.assign(stats, attr, { abspath: target })
}

const readXstat = (target, callback) => readXstatAsync(target).asCallback(callback)

// write, readlist (target, uuid, opts, callback)
// opts: {
//    writelist: optional
//    readlist: optional
//  }, null
const updateXattrPermission = (target, uuid, writelist, readlist, callback) => {

  if (!isUUID(uuid))
    return process.nextTick(() => callback(EInvalid('invalid uuid')))

  if (writelist && !(Array.isArray(writelist) && writelist.every(uuid => isUUID(uuid))))
    return process.nextTick(() => callback(EInvalid('invalid writelist')))

  if (readlist && !(Array.isArray(readlist) && readlist.every(uuid => isUUID(uuid))))
    return process.nextTick(() => callback(EInvalid('invalid readlist')))

  readXstat(target, (err, xstat) => {

    if (err) return callback(err)
    if (xstat.uuid !== uuid) return callback(InstanceMismatch()) 
    if (!xstat.isDirectory()) 
      return callback(Object.assign(new Error('not a directory'), { code: 'ENOTDIR' }))

    // remove repeate value
    if(writelist && Array.isArray(writelist))
      writelist =  nonRepeatArr(writelist)
    if(readlist && Array.isArray(readlist))
      readlist =  nonRepeatArr(readlist)
    if(writelist && readlist)
      readlist = duplicateArr(writelist, readlist)
    
    let newAttr = { uuid, writelist, readlist }
    let magic = xattr.magic;
    xattr.set(target, FRUITMIX, JSON.stringify(newAttr), err => 
      err ? callback(err) : callback(null, Object.assign(xstat, { writelist, readlist, magic })))
  })
}

const updateXattrHash = (target, uuid, hash, htime, callback) => {

  if(!isUUID(uuid))
    return process.nextTick(() => callback(EInvalid('invalid uuid')))

  if(!isSHA256(hash))
    return process.nextTick(() => callback(EInvalid('invalid hash')))

  if(!Number.isInteger(htime))
    return process.nextTick(() => callback(EInvalid('invalid htime')))

  readXstat(target, (err, xstat) => {
    if (err) return callback(err)

    // uuid mismatch
    if (xstat.uuid !== uuid) return callback(InstanceMismatch())
    // invalid magic
    if (typeof xstat.magic !== 'string' || xstat.magic.length === 0) return callback(EInvalid('invalid magic'))
    // timestamp mismatch
    if (xstat.mtime.getTime() !== htime) return callback(TimestampMismatch())

    let { writelist, readlist, magic } = xstat
    let abspath = target;
    let newAttr = { uuid, writelist, readlist, hash, htime }
    xattr.set(target, FRUITMIX, JSON.stringify(newAttr), err => 
      err ? callback(err) : callback(null, Object.assign(xstat, { hash, htime, abspath, magic })))
    
  })

}

// questionable
// fs.rename(oldpath, newpath, ...)
// transfer xattr, translate hash/htime, magic

// a file repository (path, node, uuid...)
// a tmp file, return new xstat
const copyXattr = (dst, src, callback) => {

  xattr.get(src, 'user.fruitmix', (err, attr) => {

    // src has not xattr, nothing to copy
    if (err && err.code === 'ENODATA') return callback(null)
    if (err) return callback(err)

    xattr.set(dst, 'user.fruitmix', attr, err => 
      err ? callback(err) : callback(null))
  })
}

const copyXattrAsync = Promise.promisify(copyXattr)

const testing = {}

export { 
  readTimeStamp,
  readXstat,
  readXstatAsync,
  updateXattrPermission,
  updateXattrHash,
  copyXattr,
  testing
}









