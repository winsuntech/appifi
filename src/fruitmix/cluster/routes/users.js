import { Router } from 'express'

import { localUsers } from '../model'
import auth from '../middleware/auth'
import config from '../config'

let router = Router()

// get user friends
router.get('/', auth.jwt(), (req, res) => {
  config.ipc.call('getUserFriends', (err, users) => {
    err ? res.status(500).json({})
      : res.status(200).json(Object.assign({}, { users }))
  })
})


// router.get('/', auth.jwt(), (req, res) => {
//   const user = req.user
//   if(user.isAdmin)
//     localUsers((e, users) => {
//       if(e) return res.status(500).json({})
//       return res.status(200).json(list.map(u => Object.assign({}, u, {
//         password: undefined,
//         smbPassword: undefined,
//         lastChangeTime: undefined
//       })))
//     })
//   else
//     return res.status(200).json([Object.assign({}, user, {
//       password: undefined,
//       smbPassword: undefined,
//       lastChangeTime: undefined
//     })])
// })


//req.body 
// {
//       type, username, password, nologin, isFirstUser,
//       isAdmin, email, avatar, unixname
// }
router.post('/', auth.jwt(), (req, res) => {
  const user = req.user 
  if(!user.isAdmin) return res.status(401).json({})


  let props = Object.assign({}, req.body, {
    type: 'local'
  })

  //ipc create user
  config.ipc.call('createLocalUser', { useruuid: user.uuid, props }, (err, newUser) => {
    if (err) return res.status(500).json({})
    res.status(200).json(Object.assign({}, newUser, {
        password: undefined,
        smbPassword: undefined, 
        lastChangeTime: undefined
      }))
  })
})

router.patch('/:userUUID', auth.jwt(), (req, res) => {

  const user = req.user
  const userUUID = req.params.userUUID

  if (!user.isAdmin && userUUID !== user.uuid) {
    return res.status(401).json({})
  }

  let props = Object.assign({}, req.body)


  config.ipc.call('updateUser', { useruuid: userUUID, props }, (err, newUser) => {
    if (err) return res.status(500).json({
      code: err.code,
      message: err.message
    })

    return res.status(200).json(Object.assign({}, newUser, {
      password: undefined,
      smbPassword: undefined,
      lastChangeTime: undefined
    }))
  })
})


router.patch('/',auth.jwt(), (req, res) => {
  if (req.user.isAdmin === true ) {
    if(!req.body.uuid){return res.status(400).json('uuid is missing')}
    let props = Object.assign({}, req.body)
    config.ipc.call('updateUser', { useruuid: req.body.uuid, props }, (err, newUser) => {
      if (err) return res.status(500).json({
        code: err.code,
        message: err.message
      })
      return res.status(200).json(Object.assign({}, newUser, {
        password: undefined,
        smbPassword: undefined,
        lastChangeTime: undefined
      }))
    })}
  else{
    return res.status(403).json('403 Permission denied')
  }
})

// determine whether local users
router.get('/isLocalUser', auth.jwt(), (req, res) => {
  let user = req.user
  config.ipc.call('isLocalUser', user.uuid, (err, isLocal) => {
    err ? res.status(500).json({})
      : res.status(200).json(Object.assign({}, { isLocal }))
  })
})

export default router
