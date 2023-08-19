import * as MyCode from './backend_original.js';
import { openDb } from 'gtfs';

console.log("Actually launched node, now opening database.")
const db = openDb({ sqlitePath: "whatever.sqlite" });

// http://localhost:8080/geojson?agencyKey=iarnrod&trip=2949_235&sourceStop=8250IR0014&destStop=8350IR0122&date=2023-8-19
console.log("Loaded database, now attempting to run code.")
console.log(MyCode.getYearVerdictAjax(
    db, "2949_235", "2023-8-19", "8250IR0014",
    "8350IR0122"));

