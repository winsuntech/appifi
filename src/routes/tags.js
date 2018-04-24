
/**
 * @module TagRouter
 */

module.exports = (auth, { LIST, GET, POST, PATCH, DELETE }) => {
  const EFruitless = new Error('fruitmix service unavailable')
  EFruitless.status = 503

  let router = require('express').Router()

  const fruitless = (req, res, next) => fruit() ? next() : next(EFruitless)

  const f = (res, next) => (err, data) => 
    err ? next(err) : data ? res.status(200).json(data) : res.status(200).end()

  router.get('/', fruitless, auth.jwt(), (req, res, next) => LIST(req.user, {}, f(res, next)))
  
  router.post('/', fruitless, auth.jwt(), (req, res, next) => POST(req.user, req.body, f(res, next)))
  
  router.get('/:tagId', fruitless, auth.jwt(), (req, res, next) => GET(req.user, { tagId: req.params.tagId }, f(res, next)))
  
  router.patch('/:tagId', fruitless, auth.jwt(), (req, res, next) => 
    PATCH(req.user, { tagId: req.params.tagId }, f(res, next)))
  
  router.delete('/:tagId', fruitless, auth.jwt(), (req, res, next) => 
    DELETE(req.user, { tagId:req.params.tagId }, f(res, next)))
  
  return router
}