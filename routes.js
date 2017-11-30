const express = require('express')
const app = express()
const gtfs = require('gtfs');
const MyCode = require('./some_code');
const mongoose = require('mongoose');

const config = {
  mongoUrl: 'mongodb://localhost:27017/',
};

mongoose.Promise = global.Promise;
mongoose.connect(config.mongoUrl, {useMongoClient: true});

app.use(express.static('public'))

app.set('view engine', 'pug')
app.get('/', function (req, res) {
   MyCode.getAgencyKeysP().then(result => res.render('index', { title: 'Hey', agencyKeys: result }))
})


app.get('/stops', function (req, res) {
   MyCode.getAllStopsP(req.query.agencyKey).then(result => res.send(result));
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

app.listen(8080, () => console.log('Example app listening on port 8080!'))
