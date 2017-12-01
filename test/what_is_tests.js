"use strict";

var assert = require('assert');
var MyCode = require('../some_code');

var testShapesSEPTA = require('./septa_test_shapes.json');
var testStopsSEPTA = require('./septa_test_stops.json');
var testStoptimesSEPTA = require('./septa_test_stoptimes.json');

var defaultDate = new Date(2017, 10, 5);
var defaultTimeZone = "US/Eastern";

describe('main module', function() {
  describe('shapesForStoptimePair', function() {
    it('calculates shapesForStoptimePair on NJT data', function() {
      assert.deepEqual(
        [66, 67],
        MyCode.shapesForStoptimePair(
          stoptimesResult[7], stoptimesResult[8], undefined, shapeResult[0])
        // We will just get the shape_pt_sequence to make the assertion
        // cleaner.
        .map(shape => shape['shape_pt_sequence']));
    });
    it('calculates shapesForStoptimePair on SEPTA data', function() {
      var septaResult = MyCode.shapesForStoptimePair(
          testStoptimesSEPTA[13], testStoptimesSEPTA[14],
          testStopsSEPTA, testShapesSEPTA[0]);
      // The shapes begin at Gravers...
      assert.deepEqual([-75.201663,40.07738], septaResult[0]['loc']);
      assert.deepEqual([-75.206885,40.081073],
                       septaResult[septaResult.length - 1]['loc']);
    });
  });

  describe('transitTimeToRealDate', function() {
    it('does what I want it to do', function() {
      var expected = new Date(2017, 10, 5, 16, 55, 0); // expressed in UTC
      var actual = MyCode.transitTimeToRealDate(
        defaultDate, "11:55:00", defaultTimeZone);
      assert.equal(expected.getTime(), actual.getTime());
    });
  });

  describe('atan2ToSuncalc', function() {
    it('converts 0 to -90', function() {
      assert.equal(Math.PI * -1/2, MyCode.atan2ToSuncalc(0));
    });
    it('converts 45 to -135', function() {
      assert.equal(Math.PI * -3/4, MyCode.atan2ToSuncalc(Math.PI / 4));
    });
    it('converts 90 to 180', function() {
      assert.equal(Math.PI, MyCode.atan2ToSuncalc(Math.PI / 2));
    });
    it('keeps 135 135', function() {
      assert.equal(Math.PI * 3/4, MyCode.atan2ToSuncalc(Math.PI * 3/4));
    });
    it('converts 180 to 90', function() {
      assert.equal(Math.PI * 2/4, MyCode.atan2ToSuncalc(Math.PI));
    });
    it('converts -135 to 45', function() {
      assert.equal(Math.PI * 1/4, MyCode.atan2ToSuncalc(Math.PI * -3/4));
    });
    it('converts -90 to 0', function() {
      assert.equal(0, MyCode.atan2ToSuncalc(Math.PI / -2));
    });
  });

  describe('relativeToHeading', function() {
    var NORTH = Math.PI;
    var EAST = Math.PI * -1 / 2;
    var SOUTH = 0;
    var WEST = Math.PI * 1 / 2;
    var NORTHWEST = Math.PI * 3 / 4;

    it('agrees north is left of east', function() {
      assert.equal(MyCode.sunStatus.LEFT,
                   MyCode.relativeToHeading(EAST, NORTH));
    });
    it('agrees south is right of east', function() {
      assert.equal(MyCode.sunStatus.RIGHT,
                   MyCode.relativeToHeading(EAST, SOUTH));
    });
    it('agrees north is right of northwest', function() {
      assert.equal(MyCode.sunStatus.RIGHT,
                   MyCode.relativeToHeading(NORTHWEST, NORTH));
    });
    it('agrees north is right of west', function() {
      assert.equal(MyCode.sunStatus.RIGHT,
                   MyCode.relativeToHeading(WEST, NORTH));
    });
    it('agrees north is opposite south', function() {
      assert.equal(MyCode.sunStatus.CENTER,
                   MyCode.relativeToHeading(SOUTH, NORTH));
    });
  });

  describe('sunStatusForSegment', function() {
    it('makes a lot of things work together', function() {
      var shapes = MyCode.shapesForStoptimePair(
        testStoptimesSEPTA[13], testStoptimesSEPTA[14],
        testStopsSEPTA, testShapesSEPTA[0]);
      var duration = MyCode.durationsForShapeList(
        testStoptimesSEPTA[13], testStoptimesSEPTA[14],
        shapes, defaultDate)[0]
      var startTime = MyCode.transitTimeToRealDate(
        defaultDate, testStoptimesSEPTA[13].departure_time, defaultTimeZone);
      var endTime = new Date(startTime.getTime() + duration);
      var result = MyCode.sunStatusForSegment(
        startTime, endTime, shapes[0], shapes[1]);
      assert.equal(MyCode.sunStatus.LEFT, result);
    });
  });

  describe('sunStatusForStoptimePair', function() {
    it('makes a simpler test than the last one', function() {
      var result = MyCode.sunTimesForStoptimePair(
        testStoptimesSEPTA[13], testStoptimesSEPTA[14],
        testStopsSEPTA, testShapesSEPTA[0], defaultDate, defaultTimeZone);
      assert.deepEqual([120000,0,0,0], result);
    });
  });

  describe('sunStatusAlongRoute', function() {
    it('works for adjacent stops', function() {
      var result = MyCode.sunStatusAlongRoute(
        90719, 90720, testStoptimesSEPTA, testStopsSEPTA, testShapesSEPTA[0],
        defaultDate, defaultTimeZone);
      assert.deepEqual([120000,0,0,0], result);
    });
    it('works for more stops', function() {
      var result = MyCode.sunStatusAlongRoute(
        90718, 90720, testStoptimesSEPTA, testStopsSEPTA, testShapesSEPTA[0],
        defaultDate, defaultTimeZone);
      assert.deepEqual([179999,0,0,0], result);
    });
    it('still works on some NJT data', function() {
      var result = MyCode.sunStatusAlongRoute(
        145, 87, stoptimesResult, undefined, shapeResult[0], defaultDate,
        defaultTimeZone);
      assert.deepEqual([360000,0,0,0], result); // precision still bad here
    });

    it('works all the way to NYP', function() {
      var result = MyCode.sunStatusAlongRoute(
        145, 105, stoptimesResult, undefined, shapeResult[0], defaultDate,
        defaultTimeZone);
      assert.deepEqual([379941,2080063,0,0], result);
    });

  });
});

var shapeResult = JSON.parse('[[{"shape_id":"372","shape_pt_lat":40.883415,"shape_pt_lon":-74.555887,"shape_pt_sequence":1,"shape_dist_traveled":0,"agency_key":"njt-rail","loc":[-74.555887,40.883415]},{"shape_id":"372","shape_pt_lat":40.883409,"shape_pt_lon":-74.555887,"shape_pt_sequence":2,"shape_dist_traveled":0.0004,"agency_key":"njt-rail","loc":[-74.555887,40.883409]},{"shape_id":"372","shape_pt_lat":40.883409,"shape_pt_lon":-74.55588,"shape_pt_sequence":3,"shape_dist_traveled":0.0008,"agency_key":"njt-rail","loc":[-74.55588,40.883409]},{"shape_id":"372","shape_pt_lat":40.883417,"shape_pt_lon":-74.555811,"shape_pt_sequence":4,"shape_dist_traveled":0.0044,"agency_key":"njt-rail","loc":[-74.555811,40.883417]},{"shape_id":"372","shape_pt_lat":40.884555,"shape_pt_lon":-74.545656,"shape_pt_sequence":5,"shape_dist_traveled":0.5403,"agency_key":"njt-rail","loc":[-74.545656,40.884555]},{"shape_id":"372","shape_pt_lat":40.884609,"shape_pt_lon":-74.544902,"shape_pt_sequence":6,"shape_dist_traveled":0.5797,"agency_key":"njt-rail","loc":[-74.544902,40.884609]},{"shape_id":"372","shape_pt_lat":40.884604,"shape_pt_lon":-74.544145,"shape_pt_sequence":7,"shape_dist_traveled":0.6193,"agency_key":"njt-rail","loc":[-74.544145,40.884604]},{"shape_id":"372","shape_pt_lat":40.884538,"shape_pt_lon":-74.543391,"shape_pt_sequence":8,"shape_dist_traveled":0.6589,"agency_key":"njt-rail","loc":[-74.543391,40.884538]},{"shape_id":"372","shape_pt_lat":40.884415,"shape_pt_lon":-74.542652,"shape_pt_sequence":9,"shape_dist_traveled":0.6983,"agency_key":"njt-rail","loc":[-74.542652,40.884415]},{"shape_id":"372","shape_pt_lat":40.884231,"shape_pt_lon":-74.541936,"shape_pt_sequence":10,"shape_dist_traveled":0.7379,"agency_key":"njt-rail","loc":[-74.541936,40.884231]},{"shape_id":"372","shape_pt_lat":40.883993,"shape_pt_lon":-74.541248,"shape_pt_sequence":11,"shape_dist_traveled":0.7773,"agency_key":"njt-rail","loc":[-74.541248,40.883993]},{"shape_id":"372","shape_pt_lat":40.8837,"shape_pt_lon":-74.540594,"shape_pt_sequence":12,"shape_dist_traveled":0.817,"agency_key":"njt-rail","loc":[-74.540594,40.8837]},{"shape_id":"372","shape_pt_lat":40.883686,"shape_pt_lon":-74.540565,"shape_pt_sequence":13,"shape_dist_traveled":0.8187,"agency_key":"njt-rail","loc":[-74.540565,40.883686]},{"shape_id":"372","shape_pt_lat":40.879836,"shape_pt_lon":-74.532993,"shape_pt_sequence":14,"shape_dist_traveled":1.2964,"agency_key":"njt-rail","loc":[-74.532993,40.879836]},{"shape_id":"372","shape_pt_lat":40.879545,"shape_pt_lon":-74.532339,"shape_pt_sequence":15,"shape_dist_traveled":1.336,"agency_key":"njt-rail","loc":[-74.532339,40.879545]},{"shape_id":"372","shape_pt_lat":40.87931,"shape_pt_lon":-74.531651,"shape_pt_sequence":16,"shape_dist_traveled":1.3754,"agency_key":"njt-rail","loc":[-74.531651,40.87931]},{"shape_id":"372","shape_pt_lat":40.879129,"shape_pt_lon":-74.530931,"shape_pt_sequence":17,"shape_dist_traveled":1.415,"agency_key":"njt-rail","loc":[-74.530931,40.879129]},{"shape_id":"372","shape_pt_lat":40.879006,"shape_pt_lon":-74.530192,"shape_pt_sequence":18,"shape_dist_traveled":1.4544,"agency_key":"njt-rail","loc":[-74.530192,40.879006]},{"shape_id":"372","shape_pt_lat":40.878943,"shape_pt_lon":-74.529439,"shape_pt_sequence":19,"shape_dist_traveled":1.4939,"agency_key":"njt-rail","loc":[-74.529439,40.878943]},{"shape_id":"372","shape_pt_lat":40.87894,"shape_pt_lon":-74.528681,"shape_pt_sequence":20,"shape_dist_traveled":1.5335,"agency_key":"njt-rail","loc":[-74.528681,40.87894]},{"shape_id":"372","shape_pt_lat":40.878995,"shape_pt_lon":-74.527927,"shape_pt_sequence":21,"shape_dist_traveled":1.5729,"agency_key":"njt-rail","loc":[-74.527927,40.878995]},{"shape_id":"372","shape_pt_lat":40.879112,"shape_pt_lon":-74.527187,"shape_pt_sequence":22,"shape_dist_traveled":1.6123,"agency_key":"njt-rail","loc":[-74.527187,40.879112]},{"shape_id":"372","shape_pt_lat":40.8806,"shape_pt_lon":-74.519709,"shape_pt_sequence":23,"shape_dist_traveled":2.0159,"agency_key":"njt-rail","loc":[-74.519709,40.8806]},{"shape_id":"372","shape_pt_lat":40.880707,"shape_pt_lon":-74.519005,"shape_pt_sequence":24,"shape_dist_traveled":2.0532,"agency_key":"njt-rail","loc":[-74.519005,40.880707]},{"shape_id":"372","shape_pt_lat":40.880759,"shape_pt_lon":-74.518288,"shape_pt_sequence":25,"shape_dist_traveled":2.0907,"agency_key":"njt-rail","loc":[-74.518288,40.880759]},{"shape_id":"372","shape_pt_lat":40.880754,"shape_pt_lon":-74.51757,"shape_pt_sequence":26,"shape_dist_traveled":2.1282,"agency_key":"njt-rail","loc":[-74.51757,40.880754]},{"shape_id":"372","shape_pt_lat":40.880691,"shape_pt_lon":-74.516856,"shape_pt_sequence":27,"shape_dist_traveled":2.1657,"agency_key":"njt-rail","loc":[-74.516856,40.880691]},{"shape_id":"372","shape_pt_lat":40.88057,"shape_pt_lon":-74.516154,"shape_pt_sequence":28,"shape_dist_traveled":2.2032,"agency_key":"njt-rail","loc":[-74.516154,40.88057]},{"shape_id":"372","shape_pt_lat":40.880398,"shape_pt_lon":-74.515474,"shape_pt_sequence":29,"shape_dist_traveled":2.2407,"agency_key":"njt-rail","loc":[-74.515474,40.880398]},{"shape_id":"372","shape_pt_lat":40.88017,"shape_pt_lon":-74.514819,"shape_pt_sequence":30,"shape_dist_traveled":2.2784,"agency_key":"njt-rail","loc":[-74.514819,40.88017]},{"shape_id":"372","shape_pt_lat":40.879893,"shape_pt_lon":-74.514197,"shape_pt_sequence":31,"shape_dist_traveled":2.3161,"agency_key":"njt-rail","loc":[-74.514197,40.879893]},{"shape_id":"372","shape_pt_lat":40.879567,"shape_pt_lon":-74.513619,"shape_pt_sequence":32,"shape_dist_traveled":2.3538,"agency_key":"njt-rail","loc":[-74.513619,40.879567]},{"shape_id":"372","shape_pt_lat":40.879197,"shape_pt_lon":-74.513092,"shape_pt_sequence":33,"shape_dist_traveled":2.3913,"agency_key":"njt-rail","loc":[-74.513092,40.879197]},{"shape_id":"372","shape_pt_lat":40.879154,"shape_pt_lon":-74.513034,"shape_pt_sequence":34,"shape_dist_traveled":2.3955,"agency_key":"njt-rail","loc":[-74.513034,40.879154]},{"shape_id":"372","shape_pt_lat":40.87863,"shape_pt_lon":-74.512374,"shape_pt_sequence":35,"shape_dist_traveled":2.4455,"agency_key":"njt-rail","loc":[-74.512374,40.87863]},{"shape_id":"372","shape_pt_lat":40.878334,"shape_pt_lon":-74.511963,"shape_pt_sequence":36,"shape_dist_traveled":2.4752,"agency_key":"njt-rail","loc":[-74.511963,40.878334]},{"shape_id":"372","shape_pt_lat":40.878074,"shape_pt_lon":-74.511511,"shape_pt_sequence":37,"shape_dist_traveled":2.5049,"agency_key":"njt-rail","loc":[-74.511511,40.878074]},{"shape_id":"372","shape_pt_lat":40.877849,"shape_pt_lon":-74.511023,"shape_pt_sequence":38,"shape_dist_traveled":2.5347,"agency_key":"njt-rail","loc":[-74.511023,40.877849]},{"shape_id":"372","shape_pt_lat":40.877666,"shape_pt_lon":-74.510513,"shape_pt_sequence":39,"shape_dist_traveled":2.5642,"agency_key":"njt-rail","loc":[-74.510513,40.877666]},{"shape_id":"372","shape_pt_lat":40.877523,"shape_pt_lon":-74.509974,"shape_pt_sequence":40,"shape_dist_traveled":2.5939,"agency_key":"njt-rail","loc":[-74.509974,40.877523]},{"shape_id":"372","shape_pt_lat":40.877424,"shape_pt_lon":-74.509424,"shape_pt_sequence":41,"shape_dist_traveled":2.6235,"agency_key":"njt-rail","loc":[-74.509424,40.877424]},{"shape_id":"372","shape_pt_lat":40.87737,"shape_pt_lon":-74.508859,"shape_pt_sequence":42,"shape_dist_traveled":2.6532,"agency_key":"njt-rail","loc":[-74.508859,40.87737]},{"shape_id":"372","shape_pt_lat":40.877359,"shape_pt_lon":-74.508294,"shape_pt_sequence":43,"shape_dist_traveled":2.6828,"agency_key":"njt-rail","loc":[-74.508294,40.877359]},{"shape_id":"372","shape_pt_lat":40.877394,"shape_pt_lon":-74.507724,"shape_pt_sequence":44,"shape_dist_traveled":2.7125,"agency_key":"njt-rail","loc":[-74.507724,40.877394]},{"shape_id":"372","shape_pt_lat":40.877477,"shape_pt_lon":-74.507169,"shape_pt_sequence":45,"shape_dist_traveled":2.7419,"agency_key":"njt-rail","loc":[-74.507169,40.877477]},{"shape_id":"372","shape_pt_lat":40.8776,"shape_pt_lon":-74.506625,"shape_pt_sequence":46,"shape_dist_traveled":2.7714,"agency_key":"njt-rail","loc":[-74.506625,40.8776]},{"shape_id":"372","shape_pt_lat":40.877767,"shape_pt_lon":-74.506102,"shape_pt_sequence":47,"shape_dist_traveled":2.8009,"agency_key":"njt-rail","loc":[-74.506102,40.877767]},{"shape_id":"372","shape_pt_lat":40.877972,"shape_pt_lon":-74.505604,"shape_pt_sequence":48,"shape_dist_traveled":2.8305,"agency_key":"njt-rail","loc":[-74.505604,40.877972]},{"shape_id":"372","shape_pt_lat":40.878219,"shape_pt_lon":-74.505135,"shape_pt_sequence":49,"shape_dist_traveled":2.8602,"agency_key":"njt-rail","loc":[-74.505135,40.878219]},{"shape_id":"372","shape_pt_lat":40.878342,"shape_pt_lon":-74.504935,"shape_pt_sequence":50,"shape_dist_traveled":2.8737,"agency_key":"njt-rail","loc":[-74.504935,40.878342]},{"shape_id":"372","shape_pt_lat":40.881532,"shape_pt_lon":-74.500005,"shape_pt_sequence":51,"shape_dist_traveled":3.2119,"agency_key":"njt-rail","loc":[-74.500005,40.881532]},{"shape_id":"372","shape_pt_lat":40.882031,"shape_pt_lon":-74.499151,"shape_pt_sequence":52,"shape_dist_traveled":3.2682,"agency_key":"njt-rail","loc":[-74.499151,40.882031]},{"shape_id":"372","shape_pt_lat":40.882456,"shape_pt_lon":-74.498227,"shape_pt_sequence":53,"shape_dist_traveled":3.3244,"agency_key":"njt-rail","loc":[-74.498227,40.882456]},{"shape_id":"372","shape_pt_lat":40.882809,"shape_pt_lon":-74.497254,"shape_pt_sequence":54,"shape_dist_traveled":3.3807,"agency_key":"njt-rail","loc":[-74.497254,40.882809]},{"shape_id":"372","shape_pt_lat":40.88308,"shape_pt_lon":-74.496237,"shape_pt_sequence":55,"shape_dist_traveled":3.4367,"agency_key":"njt-rail","loc":[-74.496237,40.88308]},{"shape_id":"372","shape_pt_lat":40.883272,"shape_pt_lon":-74.495189,"shape_pt_sequence":56,"shape_dist_traveled":3.493,"agency_key":"njt-rail","loc":[-74.495189,40.883272]},{"shape_id":"372","shape_pt_lat":40.883376,"shape_pt_lon":-74.494119,"shape_pt_sequence":57,"shape_dist_traveled":3.5492,"agency_key":"njt-rail","loc":[-74.494119,40.883376]},{"shape_id":"372","shape_pt_lat":40.883385,"shape_pt_lon":-74.49401,"shape_pt_sequence":58,"shape_dist_traveled":3.5549,"agency_key":"njt-rail","loc":[-74.49401,40.883385]},{"shape_id":"372","shape_pt_lat":40.883606,"shape_pt_lon":-74.489503,"shape_pt_sequence":59,"shape_dist_traveled":3.7907,"agency_key":"njt-rail","loc":[-74.489503,40.883606]},{"shape_id":"372","shape_pt_lat":40.88373,"shape_pt_lon":-74.484958,"shape_pt_sequence":60,"shape_dist_traveled":4.0282,"agency_key":"njt-rail","loc":[-74.484958,40.88373]},{"shape_id":"372","shape_pt_lat":40.883785,"shape_pt_lon":-74.482859,"shape_pt_sequence":61,"shape_dist_traveled":4.1379,"agency_key":"njt-rail","loc":[-74.482859,40.883785]},{"shape_id":"372","shape_pt_lat":40.828639,"shape_pt_lon":-74.478197,"shape_pt_sequence":62,"shape_dist_traveled":8.0326,"agency_key":"njt-rail","loc":[-74.478197,40.828639]},{"shape_id":"372","shape_pt_lat":40.797113,"shape_pt_lon":-74.474086,"shape_pt_sequence":63,"shape_dist_traveled":10.2231,"agency_key":"njt-rail","loc":[-74.474086,40.797113]},{"shape_id":"372","shape_pt_lat":40.77904,"shape_pt_lon":-74.443435,"shape_pt_sequence":64,"shape_dist_traveled":12.261,"agency_key":"njt-rail","loc":[-74.443435,40.77904]},{"shape_id":"372","shape_pt_lat":40.757028,"shape_pt_lon":-74.415105,"shape_pt_sequence":65,"shape_dist_traveled":14.3911,"agency_key":"njt-rail","loc":[-74.415105,40.757028]},{"shape_id":"372","shape_pt_lat":40.740137,"shape_pt_lon":-74.384812,"shape_pt_sequence":66,"shape_dist_traveled":16.3659,"agency_key":"njt-rail","loc":[-74.384812,40.740137]},{"shape_id":"372","shape_pt_lat":40.716549,"shape_pt_lon":-74.357807,"shape_pt_sequence":67,"shape_dist_traveled":18.5307,"agency_key":"njt-rail","loc":[-74.357807,40.716549]},{"shape_id":"372","shape_pt_lat":40.725622,"shape_pt_lon":-74.303755,"shape_pt_sequence":68,"shape_dist_traveled":21.4265,"agency_key":"njt-rail","loc":[-74.303755,40.725622]},{"shape_id":"372","shape_pt_lat":40.747621,"shape_pt_lon":-74.171943,"shape_pt_sequence":69,"shape_dist_traveled":28.4837,"agency_key":"njt-rail","loc":[-74.171943,40.747621]},{"shape_id":"372","shape_pt_lat":40.747662,"shape_pt_lon":-74.172127,"shape_pt_sequence":70,"shape_dist_traveled":28.4937,"agency_key":"njt-rail","loc":[-74.172127,40.747662]},{"shape_id":"372","shape_pt_lat":40.747612,"shape_pt_lon":-74.171904,"shape_pt_sequence":71,"shape_dist_traveled":28.5059,"agency_key":"njt-rail","loc":[-74.171904,40.747612]},{"shape_id":"372","shape_pt_lat":40.74753,"shape_pt_lon":-74.171518,"shape_pt_sequence":72,"shape_dist_traveled":28.5269,"agency_key":"njt-rail","loc":[-74.171518,40.74753]},{"shape_id":"372","shape_pt_lat":40.747418,"shape_pt_lon":-74.170853,"shape_pt_sequence":73,"shape_dist_traveled":28.5625,"agency_key":"njt-rail","loc":[-74.170853,40.747418]},{"shape_id":"372","shape_pt_lat":40.747357,"shape_pt_lon":-74.170177,"shape_pt_sequence":74,"shape_dist_traveled":28.5981,"agency_key":"njt-rail","loc":[-74.170177,40.747357]},{"shape_id":"372","shape_pt_lat":40.747349,"shape_pt_lon":-74.169498,"shape_pt_sequence":75,"shape_dist_traveled":28.6337,"agency_key":"njt-rail","loc":[-74.169498,40.747349]},{"shape_id":"372","shape_pt_lat":40.747355,"shape_pt_lon":-74.169349,"shape_pt_sequence":76,"shape_dist_traveled":28.6415,"agency_key":"njt-rail","loc":[-74.169349,40.747355]},{"shape_id":"372","shape_pt_lat":40.747494,"shape_pt_lon":-74.166436,"shape_pt_sequence":77,"shape_dist_traveled":28.7941,"agency_key":"njt-rail","loc":[-74.166436,40.747494]},{"shape_id":"372","shape_pt_lat":40.7475,"shape_pt_lon":-74.165756,"shape_pt_sequence":78,"shape_dist_traveled":28.8297,"agency_key":"njt-rail","loc":[-74.165756,40.7475]},{"shape_id":"372","shape_pt_lat":40.747451,"shape_pt_lon":-74.165076,"shape_pt_sequence":79,"shape_dist_traveled":28.8653,"agency_key":"njt-rail","loc":[-74.165076,40.747451]},{"shape_id":"372","shape_pt_lat":40.747349,"shape_pt_lon":-74.164412,"shape_pt_sequence":80,"shape_dist_traveled":28.9008,"agency_key":"njt-rail","loc":[-74.164412,40.747349]},{"shape_id":"372","shape_pt_lat":40.747193,"shape_pt_lon":-74.163763,"shape_pt_sequence":81,"shape_dist_traveled":28.9364,"agency_key":"njt-rail","loc":[-74.163763,40.747193]},{"shape_id":"372","shape_pt_lat":40.746988,"shape_pt_lon":-74.163139,"shape_pt_sequence":82,"shape_dist_traveled":28.972,"agency_key":"njt-rail","loc":[-74.163139,40.746988]},{"shape_id":"372","shape_pt_lat":40.746735,"shape_pt_lon":-74.162545,"shape_pt_sequence":83,"shape_dist_traveled":29.0076,"agency_key":"njt-rail","loc":[-74.162545,40.746735]},{"shape_id":"372","shape_pt_lat":40.746434,"shape_pt_lon":-74.161991,"shape_pt_sequence":84,"shape_dist_traveled":29.0434,"agency_key":"njt-rail","loc":[-74.161991,40.746434]},{"shape_id":"372","shape_pt_lat":40.746091,"shape_pt_lon":-74.161482,"shape_pt_sequence":85,"shape_dist_traveled":29.0792,"agency_key":"njt-rail","loc":[-74.161482,40.746091]},{"shape_id":"372","shape_pt_lat":40.746059,"shape_pt_lon":-74.161439,"shape_pt_sequence":86,"shape_dist_traveled":29.0822,"agency_key":"njt-rail","loc":[-74.161439,40.746059]},{"shape_id":"372","shape_pt_lat":40.743535,"shape_pt_lon":-74.158117,"shape_pt_sequence":87,"shape_dist_traveled":29.3295,"agency_key":"njt-rail","loc":[-74.158117,40.743535]},{"shape_id":"372","shape_pt_lat":40.743176,"shape_pt_lon":-74.15759,"shape_pt_sequence":88,"shape_dist_traveled":29.3667,"agency_key":"njt-rail","loc":[-74.15759,40.743176]},{"shape_id":"372","shape_pt_lat":40.74285,"shape_pt_lon":-74.157007,"shape_pt_sequence":89,"shape_dist_traveled":29.4047,"agency_key":"njt-rail","loc":[-74.157007,40.74285]},{"shape_id":"372","shape_pt_lat":40.742573,"shape_pt_lon":-74.156378,"shape_pt_sequence":90,"shape_dist_traveled":29.443,"agency_key":"njt-rail","loc":[-74.156378,40.742573]},{"shape_id":"372","shape_pt_lat":40.742346,"shape_pt_lon":-74.155715,"shape_pt_sequence":91,"shape_dist_traveled":29.4811,"agency_key":"njt-rail","loc":[-74.155715,40.742346]},{"shape_id":"372","shape_pt_lat":40.742176,"shape_pt_lon":-74.155026,"shape_pt_sequence":92,"shape_dist_traveled":29.5189,"agency_key":"njt-rail","loc":[-74.155026,40.742176]},{"shape_id":"372","shape_pt_lat":40.742061,"shape_pt_lon":-74.154318,"shape_pt_sequence":93,"shape_dist_traveled":29.5568,"agency_key":"njt-rail","loc":[-74.154318,40.742061]},{"shape_id":"372","shape_pt_lat":40.742,"shape_pt_lon":-74.153595,"shape_pt_sequence":94,"shape_dist_traveled":29.5949,"agency_key":"njt-rail","loc":[-74.153595,40.742]},{"shape_id":"372","shape_pt_lat":40.742,"shape_pt_lon":-74.152872,"shape_pt_sequence":95,"shape_dist_traveled":29.6328,"agency_key":"njt-rail","loc":[-74.152872,40.742]},{"shape_id":"372","shape_pt_lat":40.742115,"shape_pt_lon":-74.149797,"shape_pt_sequence":96,"shape_dist_traveled":29.7939,"agency_key":"njt-rail","loc":[-74.149797,40.742115]},{"shape_id":"372","shape_pt_lat":40.742124,"shape_pt_lon":-74.149605,"shape_pt_sequence":97,"shape_dist_traveled":29.804,"agency_key":"njt-rail","loc":[-74.149605,40.742124]},{"shape_id":"372","shape_pt_lat":40.742274,"shape_pt_lon":-74.146475,"shape_pt_sequence":98,"shape_dist_traveled":29.968,"agency_key":"njt-rail","loc":[-74.146475,40.742274]},{"shape_id":"372","shape_pt_lat":40.742304,"shape_pt_lon":-74.146011,"shape_pt_sequence":99,"shape_dist_traveled":29.9922,"agency_key":"njt-rail","loc":[-74.146011,40.742304]},{"shape_id":"372","shape_pt_lat":40.742694,"shape_pt_lon":-74.140658,"shape_pt_sequence":100,"shape_dist_traveled":30.2735,"agency_key":"njt-rail","loc":[-74.140658,40.742694]},{"shape_id":"372","shape_pt_lat":40.742726,"shape_pt_lon":-74.140245,"shape_pt_sequence":101,"shape_dist_traveled":30.2951,"agency_key":"njt-rail","loc":[-74.140245,40.742726]},{"shape_id":"372","shape_pt_lat":40.743091,"shape_pt_lon":-74.136089,"shape_pt_sequence":102,"shape_dist_traveled":30.5138,"agency_key":"njt-rail","loc":[-74.136089,40.743091]},{"shape_id":"372","shape_pt_lat":40.743107,"shape_pt_lon":-74.135864,"shape_pt_sequence":103,"shape_dist_traveled":30.5256,"agency_key":"njt-rail","loc":[-74.135864,40.743107]},{"shape_id":"372","shape_pt_lat":40.743557,"shape_pt_lon":-74.13022,"shape_pt_sequence":104,"shape_dist_traveled":30.8223,"agency_key":"njt-rail","loc":[-74.13022,40.743557]},{"shape_id":"372","shape_pt_lat":40.743565,"shape_pt_lon":-74.130141,"shape_pt_sequence":105,"shape_dist_traveled":30.8265,"agency_key":"njt-rail","loc":[-74.130141,40.743565]},{"shape_id":"372","shape_pt_lat":40.743787,"shape_pt_lon":-74.128189,"shape_pt_sequence":106,"shape_dist_traveled":30.9297,"agency_key":"njt-rail","loc":[-74.128189,40.743787]},{"shape_id":"372","shape_pt_lat":40.74422,"shape_pt_lon":-74.124368,"shape_pt_sequence":107,"shape_dist_traveled":31.1316,"agency_key":"njt-rail","loc":[-74.124368,40.74422]},{"shape_id":"372","shape_pt_lat":40.744447,"shape_pt_lon":-74.122886,"shape_pt_sequence":108,"shape_dist_traveled":31.2106,"agency_key":"njt-rail","loc":[-74.122886,40.744447]},{"shape_id":"372","shape_pt_lat":40.744795,"shape_pt_lon":-74.121446,"shape_pt_sequence":109,"shape_dist_traveled":31.2894,"agency_key":"njt-rail","loc":[-74.121446,40.744795]},{"shape_id":"372","shape_pt_lat":40.744869,"shape_pt_lon":-74.121188,"shape_pt_sequence":110,"shape_dist_traveled":31.3036,"agency_key":"njt-rail","loc":[-74.121188,40.744869]},{"shape_id":"372","shape_pt_lat":40.747204,"shape_pt_lon":-74.113438,"shape_pt_sequence":111,"shape_dist_traveled":31.7388,"agency_key":"njt-rail","loc":[-74.113438,40.747204]},{"shape_id":"372","shape_pt_lat":40.74722,"shape_pt_lon":-74.113384,"shape_pt_sequence":112,"shape_dist_traveled":31.7419,"agency_key":"njt-rail","loc":[-74.113384,40.74722]},{"shape_id":"372","shape_pt_lat":40.747399,"shape_pt_lon":-74.112843,"shape_pt_sequence":113,"shape_dist_traveled":31.7725,"agency_key":"njt-rail","loc":[-74.112843,40.747399]},{"shape_id":"372","shape_pt_lat":40.755737,"shape_pt_lon":-74.088091,"shape_pt_sequence":114,"shape_dist_traveled":33.186,"agency_key":"njt-rail","loc":[-74.088091,40.755737]},{"shape_id":"372","shape_pt_lat":40.756518,"shape_pt_lon":-74.08607,"shape_pt_sequence":115,"shape_dist_traveled":33.3042,"agency_key":"njt-rail","loc":[-74.08607,40.756518]},{"shape_id":"372","shape_pt_lat":40.756672,"shape_pt_lon":-74.085724,"shape_pt_sequence":116,"shape_dist_traveled":33.325,"agency_key":"njt-rail","loc":[-74.085724,40.756672]},{"shape_id":"372","shape_pt_lat":40.761185,"shape_pt_lon":-74.075825,"shape_pt_sequence":117,"shape_dist_traveled":33.9273,"agency_key":"njt-rail","loc":[-74.075825,40.761185]},{"shape_id":"372","shape_pt_lat":40.771412,"shape_pt_lon":-74.053384,"shape_pt_sequence":118,"shape_dist_traveled":35.2924,"agency_key":"njt-rail","loc":[-74.053384,40.771412]},{"shape_id":"372","shape_pt_lat":40.771814,"shape_pt_lon":-74.052383,"shape_pt_sequence":119,"shape_dist_traveled":35.3513,"agency_key":"njt-rail","loc":[-74.052383,40.771814]},{"shape_id":"372","shape_pt_lat":40.772135,"shape_pt_lon":-74.05133,"shape_pt_sequence":120,"shape_dist_traveled":35.4104,"agency_key":"njt-rail","loc":[-74.05133,40.772135]},{"shape_id":"372","shape_pt_lat":40.772373,"shape_pt_lon":-74.050241,"shape_pt_sequence":121,"shape_dist_traveled":35.4695,"agency_key":"njt-rail","loc":[-74.050241,40.772373]},{"shape_id":"372","shape_pt_lat":40.772521,"shape_pt_lon":-74.049125,"shape_pt_sequence":122,"shape_dist_traveled":35.5286,"agency_key":"njt-rail","loc":[-74.049125,40.772521]},{"shape_id":"372","shape_pt_lat":40.772579,"shape_pt_lon":-74.047992,"shape_pt_sequence":123,"shape_dist_traveled":35.5879,"agency_key":"njt-rail","loc":[-74.047992,40.772579]},{"shape_id":"372","shape_pt_lat":40.772549,"shape_pt_lon":-74.04686,"shape_pt_sequence":124,"shape_dist_traveled":35.6472,"agency_key":"njt-rail","loc":[-74.04686,40.772549]},{"shape_id":"372","shape_pt_lat":40.772428,"shape_pt_lon":-74.045736,"shape_pt_sequence":125,"shape_dist_traveled":35.7066,"agency_key":"njt-rail","loc":[-74.045736,40.772428]},{"shape_id":"372","shape_pt_lat":40.772217,"shape_pt_lon":-74.044638,"shape_pt_sequence":126,"shape_dist_traveled":35.7659,"agency_key":"njt-rail","loc":[-74.044638,40.772217]},{"shape_id":"372","shape_pt_lat":40.771921,"shape_pt_lon":-74.043571,"shape_pt_sequence":127,"shape_dist_traveled":35.8256,"agency_key":"njt-rail","loc":[-74.043571,40.771921]},{"shape_id":"372","shape_pt_lat":40.771543,"shape_pt_lon":-74.042552,"shape_pt_sequence":128,"shape_dist_traveled":35.885,"agency_key":"njt-rail","loc":[-74.042552,40.771543]},{"shape_id":"372","shape_pt_lat":40.771524,"shape_pt_lon":-74.042505,"shape_pt_sequence":129,"shape_dist_traveled":35.8877,"agency_key":"njt-rail","loc":[-74.042505,40.771524]},{"shape_id":"372","shape_pt_lat":40.770631,"shape_pt_lon":-74.040425,"shape_pt_sequence":130,"shape_dist_traveled":36.0133,"agency_key":"njt-rail","loc":[-74.040425,40.770631]},{"shape_id":"372","shape_pt_lat":40.762999,"shape_pt_lon":-74.02259,"shape_pt_sequence":131,"shape_dist_traveled":37.09,"agency_key":"njt-rail","loc":[-74.02259,40.762999]},{"shape_id":"372","shape_pt_lat":40.750048,"shape_pt_lon":-73.992366,"shape_pt_sequence":132,"shape_dist_traveled":38.9157,"agency_key":"njt-rail","loc":[-73.992366,40.750048]}]]');
var stoptimesResult = JSON.parse('[{"trip_id":"1325","arrival_time":"07:04:00","departure_time":"07:04:00","stop_id":"35","stop_sequence":1,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":0,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:12:00","departure_time":"07:12:00","stop_id":"34","stop_sequence":2,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":4.2085,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:19:00","departure_time":"07:19:00","stop_id":"91","stop_sequence":3,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":8.0326,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:24:00","departure_time":"07:24:00","stop_id":"92","stop_sequence":4,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":10.2231,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:28:00","departure_time":"07:28:00","stop_id":"30","stop_sequence":5,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":12.261,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:32:00","departure_time":"07:32:00","stop_id":"77","stop_sequence":6,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":14.3911,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:37:00","departure_time":"07:37:00","stop_id":"27","stop_sequence":7,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":16.3659,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:45:00","departure_time":"07:45:00","stop_id":"145","stop_sequence":8,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":18.5307,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"07:51:00","departure_time":"07:51:00","stop_id":"87","stop_sequence":9,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":21.4265,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"08:04:00","departure_time":"08:04:00","stop_id":"106","stop_sequence":10,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":28.4837,"agency_key":"njt-rail"},{"trip_id":"1325","arrival_time":"08:26:00","departure_time":"08:26:00","stop_id":"105","stop_sequence":11,"pickup_type":0,"drop_off_type":0,"shape_dist_traveled":38.9157,"agency_key":"njt-rail"}]');
var tripResult = JSON.parse('[{"_id":"59f23ab4075304548950a411","route_id":"7","service_id":"4","trip_id":"1325","trip_headsign":"NEW YORK PENN STATION","direction_id":0,"block_id":"6616","shape_id":"372","agency_key":"njt-rail"}]');
