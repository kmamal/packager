const Fs = require('fs/promises')
const Path = require('path')
const Os = require('os')
const { path7za: zip } = require('7zip-bin')
const Tar = require('tar')
const { run } = require('./run')
const { download } = require('./download')

const pack = async (options) => {
	const projectPath = Path.resolve(options?.project?.path ?? '.')
	const projectName = options?.project?.name ?? Path.basename(Path.dirname(projectPath))
	const projectVersion = options?.project?.version
	const projectFiles = options?.project?.files ?? '**/*'
	const targetVersion = options?.target?.version ?? process.version
	const targetPlatform = options?.target?.platform ?? process.platform
	const targetDir = Path.resolve(options?.target?.dir ?? '.')
	const targetName = options?.target?.name ?? [
		projectName,
		projectVersion,
		targetPlatform,
	].filter(Boolean).join('-')
	const targetFile = `${targetName}.zip`

	// Make sure the source directory exists

	const directory = Path.resolve(projectPath)
	Fs.access(directory)

	// Sort out platform-specific stuff

	let _nodeReleaseArchive
	let _nodeReleaseDir
	let extract
	let nodeName
	let npmName
	let _node
	let _npm
	let _runnerSrc
	let _runnerDst
	switch (targetPlatform) {
		case 'linux':
		case 'darwin':
		{
			_nodeReleaseArchive = `node-${targetVersion}-${targetPlatform}-x64.tar.xz`
			_nodeReleaseDir = _nodeReleaseArchive.slice(0, -7)
			extract = async (cwd) => {
				await Fs.chmod(zip, 0o777)
				await run([ zip, 'x', _nodeReleaseArchive ], { cwd })
				await Tar.extract({
					file: Path.join(cwd, _nodeReleaseArchive.slice(0, -3)),
					cwd,
				})
			}
			nodeName = 'node'
			npmName = 'npm'
			_node = Path.join('bin', nodeName)
			_npm = Path.join('bin', npmName)
			_runnerSrc = 'bash-runner.sh'
			_runnerDst = projectName
			break
		}
		case 'win32': {
			_nodeReleaseArchive = `node-${targetVersion}-win-x64.7z`
			_nodeReleaseDir = _nodeReleaseArchive.slice(0, -3)
			extract = async (cwd) => {
				await run([ zip, 'x', _nodeReleaseArchive ], { cwd })
			}
			nodeName = 'node.exe'
			npmName = 'npm.cmd'
			_node = nodeName
			_npm = npmName
			_runnerSrc = 'cmd-runner.cmd'
			_runnerDst = `${projectName}.cmd`
			break
		}
		// No default
	}

	let tmpDir
	try {
		tmpDir = await Fs.mkdtemp(Path.join(Os.tmpdir(), 'packager-'))

		console.log("Working in", tmpDir)

		// Download and extract Node.js

		const baseUrl = 'https://nodejs.org/download/release'
		const url = `${baseUrl}/${targetVersion}/${_nodeReleaseArchive}`
		const downloadDir = Path.join(tmpDir, 'download')

		console.log("Downloading", url)

		const nodeReleaseArchive = Path.join(downloadDir, _nodeReleaseArchive)
		await download(url, nodeReleaseArchive)
		await extract(downloadDir)

		const nodeReleaseDir = Path.resolve(downloadDir, _nodeReleaseDir)
		const node = Path.join(nodeReleaseDir, _node)
		const npm = Path.join(nodeReleaseDir, _npm)

		// Prepare bundle

		const stagingDir = Path.join(tmpDir, 'stage')
		const rootDir = Path.join(stagingDir, targetName)
		const bundleDir = Path.join(rootDir, 'bundle')
		const projectDir = Path.join(bundleDir, 'project')
		await Fs.mkdir(projectDir, { recursive: true })

		const { globby } = await import('globby')

		const promises = []
		const files = await globby(projectFiles, { cwd: directory })
		for (const File of files) {
			const src = Path.join(directory, File)
			const dst = Path.join(projectDir, File)
			promises.push((async () => {
				await Fs.mkdir(Path.dirname(dst), { recursive: true })
				await Fs.copyFile(src, dst)
			})())
		}

		promises.push(Fs.copyFile(node, Path.join(bundleDir, nodeName)))
		const runnerSrc = Path.join(__dirname, '../runners', _runnerSrc)
		const runnerDst = Path.join(rootDir, _runnerDst)
		promises.push(Fs.copyFile(runnerSrc, runnerDst))

		await Promise.all(promises)

		// Install new node_modules

		console.log("Installing fresh node_modules")

		await Fs.rm(
			Path.join(projectDir, 'node_modules'),
			{ recursive: true, force: true },
		)
		await run([ npm, 'install', '--production' ], { cwd: projectDir })

		// Zip up everything

		const outFile = Path.join(targetDir, targetFile)
		try { await Fs.unlink(outFile) } catch (_) { }
		await run([ zip, 'a', outFile, rootDir ])
	} finally {
		try {
			console.log("Cleaning up")

			await Fs.rm(tmpDir, { recursive: true, force: true })
		} catch (_) { }
	}
}

module.exports = { pack }
