var config = {
  mapsKey: process.env.MAPS_KEY
  , ssl: false
  , letsEncryptServer: 'staging'
  , letsEncryptContact: ''
  , letsEncryptDomains: []
  , agencies: [{ key: "iarnrod", sqlitePath: "./iarnrod.sqlite" },
  { key: "septa_rail", sqlitePath: "./septa_rail.sqlite" }]
}
export { config }
