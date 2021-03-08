#!/usr/bin/env node

// Build the backend (jetstream) code and package it into a npm package.
// This is used so that we can ship stratos as a package (optionally requiring
// one of the backends, depending on platform).  Note that cross-compilation is
// currently not supported.
//
// Options are passed in via environment variables:
//
// NPM_TAG - The tag to publish to; defaults to `latest`.
// GITHUB_REPOSITORY - GitHub package repository to publish under; defaults to NPM (at global scope).

import { spawnSync } from 'child_process';
import fs from 'fs';
import module from 'module';
import os from 'os';
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

function main() {
  /** Path to the root of the repository. */
  const stratosDir = path.resolve(url.fileURLToPath(import.meta.url), '..', '..');
  spawn('npm', 'run', 'build-backend', { cwd: stratosDir });

  const require = module.createRequire(import.meta.url);
  /** The Stratos top-level package.json */
  const stratosManifest = require(path.resolve(stratosDir, 'package.json'));

  const executableName = /^win/.test(os.platform()) ? 'jetstream.exe' : 'jetstream';

  /** The contents of the generated package.json */
  const jetstreamManifest = {
    name: `stratos-jetstream-${os.platform()}`,
    description: `${stratosManifest.description} backend`,
    os: [os.platform()],
    bin: { jetstream: `./${executableName}` },
    ..._.pick(stratosManifest, ['version', 'author', 'license', 'homepage', 'bugs']),
  };

  if (process.env.GITHUB_ACTIONS) {
    const { stdout, status, signal, error } =
      spawnSync('git', ['describe', '--always', '--exclude=*'],
        { cwd: stratosDir, stdio: ['inherit', 'pipe', 'inherit'] });
    if (error) {
      throw error;
    }
    if (signal !== null && signal !== 'SIGTERM') {
      throw new Error(`git describe exited with signal ${signal}`);
    }
    if (status !== null && status !== 0) {
      throw new Error(`git describe exited with status ${status}`);
    }
    const describe = stdout.toString().trim();
    jetstreamManifest.version += `-${describe}-${process.env.GITHUB_ACTION}`;
  }

  if (process.env.GITHUB_REPOSITORY) {
    jetstreamManifest.repository = {
      type: 'git',
      url: `https://github.com/${process.env.GITHUB_REPOSITORY}.git`,
    };
    const org = process.env.GITHUB_REPOSITORY.split('/')[0];
    jetstreamManifest.name = `@${org}/${jetstreamManifest.name}`;
  }

  console.log(jetstreamManifest);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stratos-jetstream-'));
  try {
    fs.copyFileSync(
      path.resolve(stratosDir, 'src', 'jetstream', executableName),
      path.join(workDir, executableName));
    fs.writeFileSync(
      path.join(workDir, 'package.json'),
      JSON.stringify(jetstreamManifest),
      { mode: 0o644 });
    const args = ['npm', 'publish'];
    if (process.env.NPM_TAG) {
      args.push('--tag', process.env.NPM_TAG);
    }
    spawn(...args, { cwd: workDir });
  } finally {
    fs.rmSync(workDir, { recursive: true });
  }
}

main();
