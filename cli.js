#!/usr/bin/env node
'use strict';

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const prog = require('caporal')

const middleware = require('./middleware')
const crypt = require('./utils/crypt')

const { version, description } = require('./package.json')

prog
  .version(version)
  .help(description)

prog
  .command('start')
  .description('Starts a intraserve server')
  .argument('<config-filepath>', 'Configuration filepath')
  .option('--port <port>', 'Port to bind to (fallback: PORT, then 3000)', prog.INT)
  .option('--https <force>', 'Force HTTPS in production', prog.BOOL, true)
  .option('--session-secret <secret>', 'Session secret (fallback: random)', null)
  .option('--production <force>', 'Force production', prog.BOOL, false)
  .option('--no-watch', 'Do not live-reload users JSON from configuration', prog.BOOL)
  .action(({ configFilepath }, { port, https, sessionSecret, production, noWatch }, logger) => {
    configFilepath = path.resolve(process.cwd(), configFilepath)

    try {
      var config = require(configFilepath)
    } catch (err) {
      logger.error(`Could not read config at filepath ${configFilepath}`)
      console.error(err)
      process.exit(1)
    }

    if (!port) {
      const envPort = parseInt(process.env.PORT)
      port = isNaN(envPort) ? 3000 : envPort
    }

    if (!sessionSecret) {
      sessionSecret = crypto.randomBytes(32).toString('hex')
    }

    const watchUsers = !noWatch
    const isProd = process.env.NODE_ENV === 'production' || production
    
    const app = middleware.init({ config, https, sessionSecret, isProd, watchUsers })

    app.listen(port, () => {
      console.log(`[intraserve] Listening on port ${port}`)
      console.log(`[intraverse] Serving on ${config.domain}`)
    })
  })

prog
  .command('credential')
  .description('Encrypt a password and log the resulting credentials')
  .argument('<password>', 'Password to encrypt')
  .action(async ({ password }, {}, logger) => {
    const { salt, key } = await crypt.generate(password)
    const credentials = { format: 'encrypted', key, salt }
    console.log(JSON.stringify(credentials, null, 2))
  })

prog
  .command('users:list')
  .description('Lists users and their metadata from a configuration file')
  .argument('<config-filepath>', 'Configuration filepath')
  .action(({ configFilepath }, {}, logger) => {
    try {
      var config = require(path.resolve(process.cwd(), configFilepath))
    } catch (err) {
      logger.error(`Could not read JSON at filepath ${configFilepath}`)
      console.error(err)
      process.exit(1)
    }
    
    try {
      var currentUsers = JSON.parse(fs.readFileSync(config.usersFilepath))
    } catch (err) {
      logger.error(`Could not read JSON at filepath ${config.usersFilepath}`)
      console.error(err)
      process.exit(1)
    }
    
    let users = {}

    for (const [username, info] of Object.entries(currentUsers)) {
      users[username] = {}
      users[username]['Encrypted password'] = info.credentials.format === 'encrypted'
      users[username]['Has access to'] = info.allowed ? info.allowed.join(', ') : '[everything]'
    }

    logger.info(users)
  })

prog
  .command('users:add')
  .description('Add a user to a configuration file with a secure password')
  .argument('<config-filepath>', 'Configuration filepath')
  .argument('<username>', 'Username (must be unique)')
  .argument('<password>', 'Password to encrypt')
  .option('--overwrite', 'Overwrite existing user', prog.BOOL, false)
  .option('--allowed', 'Allow access to only these app ids', prog.LIST)
  .action(async ({ configFilepath, username, password }, { overwrite, allowed }, logger) => {
    try {
      var config = require(path.resolve(process.cwd(), configFilepath))
    } catch (err) {
      logger.error(`Could not read JSON at filepath ${configFilepath}`)
      console.error(err)
      process.exit(1)
    }
    
    try {
      var currentUsers = JSON.parse(fs.readFileSync(config.usersFilepath))
    } catch (err) {
      logger.error(`Could not read JSON at filepath ${config.usersFilepath}`)
      console.error(err)
      process.exit(1)
    }

    let replace = false

    if (currentUsers[username]) {
      if (overwrite) {
        replace = true
      } else {
        logger.error(`User ${username} already exists. Use command "intraserve users:list" to see users or --overwrite to replace user's credentials.`)
        process.exit(1)
      }
    }

    const { salt, key } = await crypt.generate(password)

    currentUsers[username] = Object.assign({}, currentUsers[username] || {}, {
      credentials: { format: 'encrypted', key, salt }
    })

    if (allowed.length > 0) {
      currentUsers[username].allowed = allowed
    }

    try {
      fs.writeFileSync(path.resolve(process.cwd(), config.usersFilepath), JSON.stringify(currentUsers, null, 2))
    } catch (err) {
      logger.error(`Could not write JSON at filepath ${config.usersFilepath}. No changes were made`)
      console.error(err)
      process.exit(1)
    }

    logger.info(`User ${username} successfully ${replace ? 'modified in' : 'added to'} ${config.usersFilepath}`)
  })

prog.parse(process.argv)