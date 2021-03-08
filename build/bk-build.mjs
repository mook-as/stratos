#!/usr/bin/env node

/**
 * Build back-end Jetstream
 *
 * Usage: $0 [build|test]
 */

'use strict';

import { spawnSync } from 'child_process';
import module from 'module';
import path from 'path';
import url from 'url';
import _ from 'lodash';

/**
 * Run a given command synchronously, inheriting stdin/stdout/stderr.  An error
 * is thrown if the command exits with a non-zero exit code.
 * @param command {string} The command to execute.
 * @param args {string[]} Arguments to the command.  The last element may be
 *                        options to pass to child_process.spawn().
 */
function spawn(command, ...args) {
  /** @type {import('child_process').SpawnOptions} */
  const options = { stdio: 'inherit' };
  if (_.last(args) instanceof Object) {
    Object.assign(options, args.pop());
  }
  const { status, signal, error } = spawnSync(command, args, options);
  if (error) {
    throw error;
  }
  if (signal !== null && signal !== 'SIGTERM') {
    throw new Error(`${command} exited with signal ${signal}`);
  }
  if (status !== null && status !== 0) {
    throw new Error(`${command} exited with status ${status}`);
  }
}

/** Path to the root of the repository. */
const stratosDir = path.resolve(url.fileURLToPath(import.meta.url), '..', '..');
const jetstreamDir = path.resolve(stratosDir, 'src', 'jetstream');

// Determine the build version from the package file if not already set
const require = module.createRequire(import.meta.url);
/** The Stratos top-level package.json */
const stratosManifest = require(path.resolve(stratosDir, 'package.json'));

let version = process.env.stratos_version || 'dev';
if (version === 'dev') {
  version = stratosManifest.version;
}

const action = process.argv[2] || 'build';

spawn('go', 'env', { cwd: jetstreamDir });
console.log('Generating OpenAPI documentation...');
spawn('go', 'get', 'github.com/swaggo/swag/cmd/swag@v1.6.7', { cwd: jetstreamDir });
spawn('swag', 'init', { cwd: jetstreamDir });
if (action === 'build') {
  console.log('Building backend ...');
  console.log(`Building version: ${version}`);
  spawn('go', 'build', '-ldflags', `-X=main.appVersion=${version}`,
    { cwd: jetstreamDir, env: { ...process.env, GO111MODULE: 'on' } });
  console.log('Build complete ...');
} else {
  console.log('Running backend tests ...');
  spawn('go', 'test', './...',
    '-v', '-count=1', '-coverprofile=coverage.txt', '-covermode=atomic',
    { cwd: jetstreamDir, env: { ...process.env, GO111MODULE: 'on' } });
}
