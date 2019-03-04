var config = {
  mongoURL: process.env.MONGO_URL
, mapsKey: process.env.MAPS_KEY
, ssl: false
, letsEncryptServer: 'staging'
, letsEncryptContact: ''
, letsEncryptDomains: []
}
export {}
module.exports = config
