const express = require('express')
const app = express()
const gtfs = require('gtfs');
const MyCode = require('./backend_original');
const mongoose = require('mongoose');
const path = require('path');
const config = require('./config')
const morgan = require('morgan')

mongoose.Promise = global.Promise;
mongoose.connect(config.mongoURL, {useNewUrlParser: true});

var publicPath = path.join(__dirname, "public")
# Delete this log when Glitch is stable
console.log("Static files are stored in ", publicPath);
app.use(express.static(publicPath))
app.use('/pikaday',
        express.static('node_modules/pikaday'))

app.use(morgan('combined'))

app.set('view engine', 'pug')
app.get('/', function (req, res) { res.redirect('/trainsunthingy'); })
app.get('/trainsunthingy', function (req, res) {
  MyCode.getAgencyKeysP().then(result => res.render('index', {
    title: 'Train sun thingy',
    mapsKey: config.mapsKey,
    agencyKeys: result }))
})

app.get('/dates', function (req, res) {
   MyCode.getDates8601P(req.query.agencyKey).then(result => res.send(result));
})

app.get('/stops', function (req, res) {
   MyCode.getSourceStopsP(req.query.agencyKey).then(result => res.send(result));
})

app.get('/trips', function (req, res) {
   MyCode.getDeparturesForStopAndDateAjaxP(
     req.query.agencyKey, req.query.sourceStop, req.query.date).then(
       result => res.send(result));
})

app.get('/destinations', function (req, res) {
   MyCode.getSubsequentStopsP(
     req.query.agencyKey, req.query.sourceStop, req.query.trip).then(
       result => res.send(result));
})

//agencyKey, tripID, startDate, fromStop, toStop)
app.get('/verdict', function (req, res) {
   MyCode.getYearVerdictAjaxP(
     req.query.agencyKey, req.query.trip, req.query.date, req.query.sourceStop,
     req.query.destStop).then(result => {
     // console.log("Sending result: " + result);
     res.send(result);
   });
})

app.get('/geojson', function (req, res) {
   MyCode.getGeoJSONAjaxP(
     req.query.agencyKey, req.query.trip, req.query.date, req.query.sourceStop,
     req.query.destStop).then(result => {
     res.send(result);
   });
})

app.get('/freshness', function (req, res) {
   MyCode.dataFreshnessP().then(result => res.send(result));
})

if (config.ssl) {
  require('greenlock-express').create({
  server: config.letsEncryptServer
, email: config.letsEncryptContact
, agreeTos: true
, approveDomains: config.letsEncryptDomains
, debug: true
, app: app
  }).listen(80, 443);
}
else {
  app.listen(8080, () => console.log('Example app listening on port 8080!'));
}
