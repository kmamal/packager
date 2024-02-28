const Fs = require('node:fs')
const Path = require('node:path')
const Os = require('node:os')
const { path7za: zip } = require('7zip-bin')
const Tar = require('tar')
const { run } = require('./util/run.js')
const { download } = require('./util/download.js')
const Ejs = require('ejs')


const pack = async (options) => {
	const { project = {}, target = {} } = options ?? {}

	// Determine input dir and make sure it exists.

	const projectPath = Path.resolve(project.path ?? '.')

	let stats
	try {
		stats = await Fs.promises.stat(projectPath)
	} catch (error) {
		console.error("Failed to find input dir!")
	}
	if (!stats.isDirectory()) {
		console.error("Input path is not a directory!")
		throw new Error(`Path "${projectPath}" is not a directory`)
	}

	// Try to load the project's `package.json` file

	let packageJson
	try {
		const packageJsonPath = Path.join(projectPath, 'package.json')
		packageJson = JSON.parse(await Fs.promises.readFile(packageJsonPath))
	} catch (error) {
		if (error.code !== 'ENOENT') { throw error }
		packageJson = {}
	}

	// Determine the rest of the params

	const projectName = project.name ?? Path.basename(packageJson.name ?? projectPath)
	const projectVersion = project.version ?? packageJson.version ?? '0.0.0'
	const projectFiles = project.files ?? '**/*'

	const targetVersion = target.version ?? process.version
	const targetPlatform = target.platform ?? process.platform
	const targetArch = target.arch ?? process.arch
	const targetDir = Path.resolve(target.dir ?? '.')
	const targetName = target.name ?? [
		projectName,
		projectVersion,
		targetPlatform,
		targetArch,
	].filter(Boolean).join('-')
	const targetFlags = (target.flags ?? []).map((flag) => flag.trim())
	const targetShouldZip = target.shouldZip
	const targetZipFileName = `${targetName}.zip`

	// Sort out platform-specific stuff

	let nodeReleaseArchiveName
	let nodeReleaseDirName
	let fnExtract
	let nodeName
	let npmName
	let nodeBinName
	let npmBinName
	let runnerSrcName
	let runnerDstName
	switch (targetPlatform) {
		case 'linux':
		case 'darwin':
		{
			nodeReleaseArchiveName = `node-${targetVersion}-${targetPlatform}-${targetArch}.tar.xz`
			nodeReleaseDirName = nodeReleaseArchiveName.slice(0, -'.tar.xz'.length)
			fnExtract = async (cwd) => {
				await Fs.promises.chmod(zip, 0o700)
				await run([ zip, 'x', nodeReleaseArchiveName ], { cwd })
				await Tar.extract({
					file: Path.join(cwd, nodeReleaseArchiveName.slice(0, -'.xz'.length)),
					cwd,
				})
			}
			nodeName = 'node'
			npmName = 'npm'
			nodeBinName = Path.join('bin', nodeName)
			npmBinName = Path.join('bin', npmName)
			runnerSrcName = 'bash-runner.sh.ejs'
			runnerDstName = projectName
			break
		}
		case 'win32': {
			nodeReleaseArchiveName = `node-${targetVersion}-win-${targetArch}.7z`
			nodeReleaseDirName = nodeReleaseArchiveName.slice(0, -3)
			fnExtract = async (cwd) => {
				await run([ zip, 'x', nodeReleaseArchiveName ], { cwd })
			}
			nodeName = 'node.exe'
			npmName = 'npm.cmd'
			nodeBinName = nodeName
			npmBinName = npmName
			runnerSrcName = 'cmd-runner.cmd.ejs'
			runnerDstName = `${projectName}.cmd`
			break
		}
		// No default
	}

	let tmpDir
	try {
		tmpDir = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), 'packager-'))

		console.log("Working in", tmpDir)

		// Download and extract Node.js

		const baseUrl = 'https://nodejs.org/download/release'
		const url = `${baseUrl}/${targetVersion}/${nodeReleaseArchiveName}`
		const downloadDir = Path.join(tmpDir, 'download')

		console.log("Downloading", url)

		const nodeReleaseArchivePath = Path.join(downloadDir, nodeReleaseArchiveName)
		try {
			await download(url, nodeReleaseArchivePath)
		} catch (error) {
			console.error("Download failed!")
			throw error
		}

		console.log("Extracting", nodeReleaseArchiveName)

		try {
			await fnExtract(downloadDir)
		} catch (error) {
			console.error("Extract failed!")
			throw error
		}

		const nodeReleaseDirPath = Path.resolve(downloadDir, nodeReleaseDirName)
		const nodeBinPath = Path.join(nodeReleaseDirPath, nodeBinName)
		const npmBinPath = Path.join(nodeReleaseDirPath, npmBinName)

		// Prepare bundle

		console.log("Packaging", projectPath)

		const stagingDir = Path.join(tmpDir, 'stage')
		const outRootDir = Path.join(stagingDir, targetName)
		const outBundleDir = Path.join(outRootDir, 'bundle')
		const outProjectDir = Path.join(outBundleDir, 'project')

		try {
			await Fs.promises.mkdir(outProjectDir, { recursive: true })

			await Promise.all([

				// Copy the Node.js binary
				Fs.promises.cp(nodeBinPath, Path.join(outBundleDir, nodeName)),

				// Render and copy the "executable" script from its template
				(async () => {
					const runnerSrcPath = Path.join(__dirname, '../runner-templates', runnerSrcName)
					const runnerTemplate = await Fs.promises.readFile(runnerSrcPath, { encoding: 'utf8' })
					const runnerCode = Ejs.render(runnerTemplate, { flags: targetFlags.join(' ') })
					const runnerDstPath = Path.join(outRootDir, runnerDstName)
					await Fs.promises.writeFile(runnerDstPath, runnerCode)

					if (targetPlatform !== 'win32') {
						await Fs.promises.chmod(runnerDstPath, 0o755)
					}
				})(),

				// Find and copy all the project files
				import('globby').then(async ({ globby }) => {
					const promises = []

					const files = await globby(projectFiles, { cwd: projectPath })
					for (const file of files) {
						const src = Path.join(projectPath, file)
						const dst = Path.join(outProjectDir, file)
						promises.push((async () => {
							await Fs.promises.mkdir(Path.dirname(dst), { recursive: true })
							await Fs.promises.cp(src, dst)
						})())
					}

					await Promise.all(promises)
				}),
			])
		} catch (error) {
			console.error("Packaging failed!")
			throw error
		}

		// Install new node_modules

		console.log("Installing fresh node_modules")

		await Fs.promises.rm(
			Path.join(outProjectDir, 'node_modules'),
			{ recursive: true, force: true },
		)
		await run([ npmBinPath, 'install', '--omit=dev' ], { cwd: outProjectDir })

		// Copy results to output dir

		await Fs.promises.mkdir(targetDir, { recursive: true })
		if (targetShouldZip) {
			// Zip up everything
			const targetZipFilePath = Path.join(targetDir, targetZipFileName)
			try { await Fs.promises.rm(targetZipFilePath) } catch (_) { }
			await run([ zip, 'a', targetZipFilePath, outRootDir ])
		} else {
			// Copy the dir as-is
			await Fs.promises.rename(outRootDir, Path.join(targetDir, targetName))
		}
	} finally {
		try {
			console.log("Cleaning up")

			await Fs.promises.rm(tmpDir, { recursive: true, force: true })
		} catch (_) { }
	}
}

module.exports = { pack }
