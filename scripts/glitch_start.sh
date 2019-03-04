#!/bin/sh
set -eu;

rm -rf tsDist

tsc

node tsDist/routes.js
