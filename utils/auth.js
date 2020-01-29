const tsscmp = require('tsscmp')

const users = require('./users')
const crypt = require('./crypt')

async function checkCredentials (requestUsername, requestPassword) {
  const currentUsers = users.getCurrentUsers()
  
  const storedUser = currentUsers[requestUsername]
  if (!storedUser) return false

  const { format, password, salt, key } = storedUser.credentials

  let isValid = false

  if (format === 'encrypted') {
    isValid = await crypt.compare(requestPassword, salt, key)
  }

  if (format === 'plain') {
    isValid = tsscmp(requestPassword, password)
  }

  return isValid
}

async function checkBasicAuth (header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false

  try {
    const b64 = header.split('Bearer ')[1]
    const [username, password] = Buffer.from(b64, 'base64').toString('utf-8').split(':')
    const isValid = await checkCredentials(username, password)
    return isValid ? username : false
  } catch (err) {
    return false
  }
}

function restrict (appId, domain) {
  return async (req, res, next) => {
    const currentUsers = users.getCurrentUsers()

    // Try to do basic auth (for API use)
    if (!req.session || !req.session.username) {
      const validBasicAuthUsername = await checkBasicAuth(req.headers.authorization)
      
      if (validBasicAuthUsername) {
        req.session.username = validBasicAuthUsername
      } else {
        return res.redirect((req.secure ? 'https://' : 'http://') + domain)
      }
    }
    
    const user = currentUsers[req.session.username]
    
    if (user.allowed && !user.allowed.includes(appId)) {
      return res.status(404).send()
    }

    return next()
  }
}

exports.checkCredentials = checkCredentials
exports.restrict = restrict