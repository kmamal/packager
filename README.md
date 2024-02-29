# @kmamal/packager

[![Package](https://img.shields.io/npm/v/%2540kmamal%252Fpackager)](https://www.npmjs.com/package/@kmamal/packager)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@kmamal/packager)](https://libraries.io/npm/@kmamal%2Fpackager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bundles a Node.js application into a self-contained zip.
Useful when you want to distribute your application without requiring your users to install node/npm first.


## Installation

Install with:

```bash
npm i --save-dev @kmamal/packager
```


## Usage

Inside your project root run:

```bash
npx packager --out-dir dist
```

This should produce a folder named `dist/` with a `.zip` file inside it named `{name}-{version}-{platform}-{arch}.zip` where `name` and `version` are taken from the `package.json` file, and `platform` and `arch` are equal to `process.platform` and `process.arch` in Node.js.

The folder structure inside the archive is:

```
 demo-1.2.3-win32-x64/
 ├─ demo.cmd         # executable with console
 ├─ demo.vbs         # executable without console
 └─ bundle/
    ├─ node.exe      # node binary
    └─ project/
       ├─ ...        # all the files from the input directory
```

The "executables" (`demo.cmd` and `demo.vbs` in the above example) are simple scripts the call the equivalent of `node.exe project/`, and should work no matter which directory they are called from. The `.cmd` and `.vbs` extensions are only for Windows bundles. On Linux and Mac there's a single script and it has no extension, so it would be called just `demo`.

**Note:** Make sure your `package.json` has a `"main"` entrypoint set, otherwise the executable scripts won't know how to run your project.


## Command Line Options

#### -a, --arch ARCH

By default, `packager` will create a bundle for the current architecture, as per `process.arch`.
You can set this option to create a bundle for some other architecture, simply by downloading and bundling the node binary for that platform.

**WARNING:** This will of course fail if some of your dependencies are platform-specific (for example, native bindings downloaded into `node_modules`).
It's usually safer to build each bundle on its corresponding host (for example via [GitHub Actions](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#example-running-with-more-than-one-operating-system)).

#### -i, --in-dir INPUT_DIRECTORY

By default, the current directory will be bundled.
You can set this option to specify some other directory to bundle up.
One common use-case is to specify a "staging" folder into which you have collected only the files you want to include in the release.

#### -I, --include PATTERN

By default, all the files in the input directory will be included (or, more accurately, anything matched by `**/*`).
You can set this option (one or multiple times) to specify a different set of patterns.
The resulting list of patterns will be passed as an argument to [`globby`](https://www.npmjs.com/package/globby).
For example `-I 'src/**/*.js' -I 'assets/**/*' -I 'package*.json'` will include all the `.js` files in `src/`, all the files in `assets/` and the `package.json` and `package-lock.json` files.

#### -f, --flag FLAG

By default, the Node.js executable will be called like `node <project>`, with no command-line flags.
You can set this option (one or multiple times) each time passing a flag as the argument that will be forwarded to Node.js.
For example `-f="--experimental-network-imports"` will make the final executable invoke node like `node --experimental-network-imports <project>`.

#### -o, --out-dir OUTPUT_DIRECTORY

By default, the resulting `.zip` file will be placed in the current directory. You can set this option to specify some other output directory. If it does not exist it will be created.

#### -n, --out-name OUTPUT_NAME

By default, the resulting `.zip` file will be named `{name}-{version}-{platform}-{arch}.zip` where `name` and `version` are taken from the `package.json` file, and `platform` and `arch` are equal to `process.platform` and `process.arch` in Node.js. You can set this option to name the output file something else. This only affects the part before the extension (the extension is always `.zip`) so for example if you set `-n package` the output file will be named `package.zip`.

#### -t, --target TARGET

By default, `packager` will include the currently installed node version in the bundle. You can set this option to specify some other node version to use. For example if you set `-t v12.22.1` then the node binary for that version will be downloaded and bundled up.

#### -p, --platform PLATFORM

By default, `packager` will create a bundle for the current platform, as per `process.platform`.
You can set this option to create a bundle for some other platform, simply by downloading and bundling the node binary for that platform.

**WARNING:** This will of course fail if some of your dependencies are platform-specific (for example, native bindings downloaded into `node_modules`).
It's usually safer to build each bundle on its corresponding host (for example via [GitHub Actions](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#example-running-with-more-than-one-operating-system)).

#### -u, --unzip

By default, the bundle folder will be zipped to produce the final `.zip` file.
You can pass this option to prevent the final zipping to take place.
This can be useful if you want to further customize the output bundle yourself.
So instead of getting a `demo-1.2.3-win32-x64.zip` file in your output folder, you will instead get a `demo-1.2.3-win32-x64` folder.
