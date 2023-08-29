var config = {
  mapsKey: process.env.MAPS_KEY
  , ssl: false
  , letsEncryptServer: 'staging'
  , letsEncryptContact: ''
  , letsEncryptDomains: []
  , sqliteStoragePath: './sqlite'
}
export { config }
