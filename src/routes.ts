import express from "express";
const app = express()
import { openDb } from 'gtfs';
import { readFile } from 'fs/promises';
import * as MyCode from './backend_original.js';
const path = require('path');
const config = require('./config')
const morgan = require('morgan')
const db = openDb(config);


var publicPath = path.join(__dirname, "public")
// Delete this log when Glitch is stable
console.log("Static files are stored in ", publicPath);
app.use(express.static(publicPath))
app.use('/pikaday',
  express.static('node_modules/pikaday'))

app.use(morgan('combined'))

app.set('view engine', 'pug')
app.get('/', function (req, res) { res.redirect('/trainsunthingy'); })
app.get('/trainsunthingy', function (req, res) {
  return res.render('index', {
    title: 'Train sun thingy',
    mapsKey: config.mapsKey,
    agencyKeys: MyCode.getAgencyKeys()
  });
})

app.get('/dates', function (req, res) {
  res.send(MyCode.getDates8601(db, req.query.agencyKey))
})

app.get('/stops', function (req, res) {
  res.send(MyCode.getSourceStops(db, req.query.agencyKey))
})

app.get('/trips', function (req, res) {
  res.send(MyCode.getDeparturesForStopAndDateAjax(
    db, req.query.agencyKey, req.query.sourceStop, req.query.date))
})

app.get('/destinations', function (req, res) {
  res.send(MyCode.getSubsequentStops(
    req.query.agencyKey, req.query.sourceStop, req.query.trip))
})

//agencyKey, tripID, startDate, fromStop, toStop)
app.get('/verdict', function (req, res) {
  res.send(MyCode.getYearVerdictAjax(
    req.query.agencyKey, req.query.trip, req.query.date, req.query.sourceStop,
    req.query.destStop))
})

app.get('/geojson', function (req, res) {
  res.send(MyCode.getGeoJSONAjax(
    req.query.agencyKey, req.query.trip, req.query.date, req.query.sourceStop,
    req.query.destStop))
})

app.get('/freshness', function (req, res) {
  res.send(MyCode.dataFreshness())
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
