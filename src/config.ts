var config = {
  mapsKey: process.env.MAPS_KEY
  , ssl: false
  , letsEncryptServer: 'staging'
  , letsEncryptContact: ''
  , letsEncryptDomains: []
  , agencies: [{ key: "iarnrod", sqlitePath: "./whatever.sqlite"}]
}
export { config }
