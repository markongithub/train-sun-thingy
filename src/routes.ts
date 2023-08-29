import "dotenv/config.js";
import express from "express";
const app = express()
import { getStops, openDb } from 'gtfs';
import { readFile } from 'fs/promises';
import * as MyCode from './backend_original.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config.js';
import logger from 'morgan';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var publicPath = path.join(__dirname, "public")

console.log(process.env);
var dbMap = new Map();
fs.readdir(config.sqliteStoragePath, function (err, files) {
  if (err) throw err;
  files.forEach(function (file) {
    if (path.extname(file) == ".sqlite") {
      const agencyKey = path.basename(file, ".sqlite");
      const filePath = path.join(config.sqliteStoragePath, file);;
      const dbObj = openDb({ sqlitePath: filePath });
      dbMap.set(agencyKey, dbObj);
      const stopCount = getStops({}, [], [], { db: dbObj }).length;
      console.log("Set database in map for " + agencyKey + " at path " + filePath + " with " + stopCount + " stops and now dbMap is of size " + dbMap.size);
    };
  });
});

// Delete this log when Glitch is stable
console.log("Static files are stored in ", publicPath);
app.use(express.static(publicPath))
app.use('/pikaday',
  express.static('node_modules/pikaday'))

app.use(logger('combined'))

app.set('view engine', 'pug')
app.get('/', function (req, res) { res.redirect('/trainsunthingy'); })
app.get('/trainsunthingy', function (req, res) {
  const agencyKeys = Array.from(dbMap.keys());
  console.log("agencyKeys: " + agencyKeys)
  return res.render('index', {
    title: 'Train sun thingy',
    mapsKey: config.mapsKey,
    agencyKeys: agencyKeys
  });
})

app.get('/dates', function (req, res) {
  res.send(MyCode.getDates8601(dbMap.get(req.query.agencyKey)))
})

app.get('/stops', function (req, res) {
  res.send(MyCode.getSourceStops(dbMap.get(req.query.agencyKey)))
})

app.get('/trips', function (req, res) {
  res.send(MyCode.getDeparturesForStopAndDateAjax(
    dbMap.get(req.query.agencyKey), req.query.sourceStop, req.query.date))
})

app.get('/destinations', function (req, res) {
  res.send(MyCode.getSubsequentStops(
    dbMap.get(req.query.agencyKey), req.query.sourceStop, req.query.trip))
})

//agencyKey, tripID, startDate, fromStop, toStop)
app.get('/verdict', function (req, res) {
  res.send(MyCode.getYearVerdictAjax(
    dbMap.get(req.query.agencyKey), req.query.trip, req.query.date, req.query.sourceStop,
    req.query.destStop))
})

app.get('/geojson', function (req, res) {
  res.send(MyCode.getGeoJSONAjax(
    dbMap.get(req.query.agencyKey), req.query.trip, req.query.date, req.query.sourceStop,
    req.query.destStop))
})

app.get('/freshness', function (req, res) {
  res.send(MyCode.dataFreshness(dbMap))
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
