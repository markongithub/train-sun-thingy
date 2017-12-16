const express = require('express')
const app = express()
const gtfs = require('gtfs');
const MyCode = require('./some_code');
const mongoose = require('mongoose');

const config = {
  mongoUrl: 'mongodb://mongo:27017/',
};

mongoose.Promise = global.Promise;
mongoose.connect(config.mongoUrl, {useMongoClient: true});

app.use(express.static('public'))
app.use('/pikaday',
        express.static('node_modules/pikaday'))

app.set('view engine', 'pug')
app.get('/', function (req, res) {
   MyCode.getAgencyKeysP().then(result => res.render('index', { title: 'Train sun thingy', agencyKeys: result }))
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
     console.log("Sending result: " + result);
     res.send(result);
   });
})

app.get('/geojson', function (req, res) {
   MyCode.getGeoJSONAjaxP(
     req.query.agencyKey, req.query.trip, req.query.date, req.query.sourceStop,
     req.query.destStop).then(result => {
     console.log("Sending result: " + result);
     res.send(result);
   });
})

app.listen(8080, () => console.log('Example app listening on port 8080!'))
