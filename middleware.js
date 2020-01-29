process.on('uncaughtException', err => { throw err })
process.on('unhandledRejection', err => { throw err })

const fs = require('fs')
const path = require('path')

const express = require('express')
const cookieSession = require('cookie-session')
const ejs = require('ejs')
const bodyParser = require('body-parser')
const vhost = require('vhost')

// https://github.com/zeit/serve-handler
const static = require('serve-handler')
// https://github.com/chimurai/http-proxy-middleware
const proxy = require('http-proxy-middleware')

exports.crypt = require('./utils/crypt')

exports.init = function init ({ config, https, sessionSecret, isProd, watchUsers }) {
  const users = require('./utils/users')
  const auth = require('./utils/auth')

  const templates = {
    home: ejs.compile(fs.readFileSync(path.resolve(__dirname, 'views/home.ejs'), 'utf-8')),
    login: ejs.compile(fs.readFileSync(path.resolve(__dirname, 'views/login.ejs'), 'utf-8')),
  }

  const app = express()
  app.set('trust proxy', 1)

  app.use(cookieSession({
    secret: sessionSecret,

    domain: config.domain,
    path: '/',
    maxAge: 1000*60*60*24*30,
    secure: isProd && https,
    sameSite: 'lax',
  }))
  
  if (https && isProd) {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] !== 'https') {
        res.redirect(307, 'https://' + req.hostname + req.originalUrl)
      } else {
        next()
      }
    })
  }
  
  for (const { id, name, host, getMiddleware } of config.apps) {
    const virtualApp = express()
    virtualApp.set('trust proxy', 1)
    virtualApp.use(auth.restrict(id, config.domain))
    virtualApp.use(getMiddleware({ static, proxy }))
    app.use(vhost(host, virtualApp))
    console.log(`[intraserve] App "${id}" (${name}) listening to ${host}`)
  }
  
  users.loadUsers(config.usersFilepath)
  
  if (watchUsers) {
    console.log(`[intraserve] Watching ${config.usersFilepath} for changes`)

    require('chokidar').watch(config.usersFilepath).on('change', (event, path) => {
      console.log(`[intraserve] Updating internal users`)
      users.loadUsers(config.usersFilepath)
    })
  }

  app.get('/', (req, res) => {  
    if (!req.session.username) {
      const logout = req.query.logout === '1'
      const invalid = req.query.invalid === '1'
    
      return res.status(200).send(templates.login({ logout, invalid }))
    }

    const currentUsers = users.getCurrentUsers()
    const user = currentUsers[req.session.username]

    const appsList = config.apps
      .filter(app => !user.allowed || user.allowed.includes(app.id))
      .map(({ id, name, description, host, path = '/' }) => {
        const url = '//' + host + path
        return { id, name, description, url }
      })
  
    const html = templates.home({ appsList })
    res.status(200).send(html)
  })
  
  app.post('/', bodyParser.urlencoded({ extended: false }), async (req, res) => {
    const isValid = await auth.checkCredentials(req.body.username, req.body.password)
  
    if (isValid) {
      req.session.username = req.body.username
      return res.redirect(`/`)
    } else {
      return res.redirect(`/?invalid=1`)
    }
  })
  
  app.use('/logout', (req, res) => {
    req.session = null
    return res.redirect(`/?logout=1`)
  })

  return app
}