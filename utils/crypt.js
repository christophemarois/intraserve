const crypto = require('crypto')
const tsscmp = require('tsscmp')

function pbkdf2 (password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 1000, 64, `sha512`, (err, keyBuffer) => {
      if (err) {
        reject(err)
      } else {
        resolve(keyBuffer)
      }
    })
  }).then(keyBuffer => keyBuffer.toString(`hex`))
}

exports.generate = async function generate (plainPassword) {
  // Creating a unique salt for a particular user 
  const salt = crypto.randomBytes(16).toString('hex')
  
  // Hashing user's salt and password with 1000 iterations,  64 length and sha512 digest 
  const key = await pbkdf2(plainPassword, salt)

  return { salt, key }
}

exports.compare = async function compare (requestPassword, storedSalt, storedKey) {
  const requestKey = await pbkdf2(requestPassword, storedSalt)
  return tsscmp(requestKey, storedKey)
}