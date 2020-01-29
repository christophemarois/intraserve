const fs = require('fs')
const EventEmitter = require('events').EventEmitter

const events = new EventEmitter()

let currentUsers = null

function getCurrentUsers () {
  return currentUsers
}

function loadUsers (usersFilepath) {
  try {
    const nextUsers = JSON.parse(fs.readFileSync(usersFilepath))
    // Validate schema here
    currentUsers = Object.freeze(nextUsers)
    events.emit('change', currentUsers)
  } catch (e) {
    const err = new Error(`Error parsing JSON at "${usersFilepath}"`)

    if (currentUsers === null) {
      throw err
    } else {
      console.error(err)
    }
  }

  return currentUsers
}

exports.events = events
exports.getCurrentUsers = getCurrentUsers
exports.loadUsers = loadUsers