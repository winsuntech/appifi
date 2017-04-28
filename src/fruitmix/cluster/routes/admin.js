
import { Router } from 'express'
import config from '../config'

let router = Router();

// get all local user info
router.get('/users', (req, res) => {

	// permission useruuid
	let useruuid = req.user.uuid;
	config.ipc.call('getAllLocalUser', useruuid, (err, users) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { users }))
	})
})

// get all public drive
router.get('/drives', (req, res) => {
	let useruuid = req.user.uuid
	config.ipc.call('getAllPublicDrive', useruuid, (err, drives) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drives }))
	})
})

// add pulbic drive
router.post('/drives', (req, res) => {
	// permission useruuid
	let useruuid = req.user.uuid;
	let drive = req.drive;
	config.ipc.call('createPublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drive }))
	})
})

// update public drive
router.patch('/:driveUUID', (req, res) => {
	// permission useruuid
	let useruuid = req.user.uuid;
	let drive = req.drive;
	config.ipc.call('updatePublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drive }))
	})
})

export default router