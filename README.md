# @kmamal/packager

[![Package](https://img.shields.io/npm/v/%2540kmamal%252Fpackager)](https://www.npmjs.com/package/@kmamal/packager)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@kmamal/packager)](https://libraries.io/npm/@kmamal%2Fpackager)
[![Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/%2540kmamal%252Fpackager)](https://snyk.io/test/npm/@kmamal/packager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bundles a Node.js application into a self-contained zip archive. Useful when you want to distribute your application without requiring your users to install node/npm first.

Should work for x64 Linux, Mac, and Windows.


## Usage

Install with:

```bash
npm i --save-dev @kmamal/packager
```

Then inside your project root run:

```bash
npx packager --out-dir dist
```

This should produce a folder named `dist/` with a `.zip` file inside it named `{name}-{version}-{platform}.zip` where `name` and `version` are taken from the `package.json` file, and `platform` is equal to `process.platform` in Node.js.

The folder structure inside the archive is:

```
 demo-1.2.3-win32/
 ├─ demo.cmd         # executable
 └─ bundle/
    ├─ node.exe      # node binary
    └─ project/
       ├─ ...        # all the files from the input directory
```

The "executable" (`demo.cmd` in the above example) is a simple script the calls the equivalent of `node project/`, and should work no matter which directory it is called from. Make sure your `package.json` has a `"main"` entrypoint set, otherwise it won't work. The `.cmd` extension is only for Windows bundles. On Linux and Mac it would be called just `demo`.


## Command Line Options

#### -I, --in-dir INPUT_DIRECTORY

By default, `packager` will bundle up the current directory. You can set this option to specify some other directory to bundle up. One common use-case is to specify a "staging" folder into which you have collected only the files you want to include in the release.

#### -O, --out-dir OUTPUT_DIRECTORY

By default, `packager` will place the resulting `.zip` file in the current directory. You can set this option to specify some other output directory.

#### -n, --out-name OUTPUT_NAME

By default, the resulting `.zip` file will be named `{name}-{version}-{platform}.zip` where `name` and `version` are taken from the `package.json` file, and `platform` is equal to `process.platform` in Node.js. You can set this option to name the output file something else. This only affects the part before the extension (the extension is always `.zip`) so for example if you set `-n package` the output file will be named `package.zip`.

#### -t, --target TARGET

By default, `packager` will include the currently installed node version in the bundle. You can set this option to specify some other node version to use. For example if you set `-t v12.22.1` then the node binary for that version will be downloaded and bundled up.

#### -p, --platform PLATFORM

By default, `packager` will create a bundle for the current platform (`'linux'`, `'darwin'`, or `'win32'` as per `process.platform`). You can set this option to create a bundle for some other platform, simply by downloading and bundling the node binary for that platform. __WARNING:__ This will of course fail if some of your dependencies are platform-specific (for example, native bindings downloaded into `node_modules`). It's usually safer to build each platform's bundle on its corresponding host (for example via [GitHub Actions](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#example-running-with-more-than-one-operating-system)).
