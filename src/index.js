const Fsp = require('fs/promises')
const Path = require('path')
const Os = require('os')
const download = require('download')
const { path7za: zip } = require('7zip-bin')
const { spawn } = require('child_process')
const Tar = require('tar')
const Fse = require('fs-extra')

const _run = async (command, args, options, callback) => {
	const proc = spawn(command, args, options)
	callback?.(proc)
	await new Promise((resolve, reject) => {
		proc.on('close', (code) => {
			code ? reject(new Error(`exit code ${code}`)) : resolve()
		})
	})
}

const run = ([ command, ...args ], options = {}) => _run(
	command,
	args,
	options,
	(proc) => {
		proc.stdout.on('data', (chunk) => { console.error(chunk.toString()) })
		proc.stderr.on('data', (chunk) => { console.error(chunk.toString()) })
	},
)

const base_url = 'https://nodejs.org/download/release'


const package = async (options) => {
	const project_path = Path.resolve(options?.project?.path ?? '.')
	const project_name = options?.project?.name ?? Path.basename(Path.dirname(project_path))
	const project_version = options?.project?.version
	const target_version = options?.target?.version ?? process.version
	const target_platform = options?.target?.platform ?? process.platform
	const target_dir = Path.resolve(options?.target?.dir ?? '.')
	const target_name = options?.target?.name ?? [
		project_name,
		project_version,
		target_platform,
	].filter(Boolean).join('-')
	const target_file = `${target_name}.zip`


	// Make sure the source directory exists

	const directory = Path.resolve(project_path)
	Fsp.access(directory)

	// Sort out platform-specific stuff

	let node_archive
	let _extracted_dir
	let extract
	let node_name
	let npm_name
	let _node
	let _npm
	let runner
	let runner_ext
	switch (target_platform) {
		case 'linux':
		case 'darwin':
		{
			node_archive = `node-${target_version}-${target_platform}-x64.tar.xz`
			_extracted_dir = node_archive.slice(0, -7)
			extract = async (tmp_dir) => {
				await run([ zip, 'x', node_archive ], { cwd: tmp_dir })
				await Tar.extract({
					file: Path.join(tmp_dir, node_archive.slice(0, -3)),
					cwd: tmp_dir,
				})
			}
			node_name = 'node'
			npm_name = 'npm'
			_node = Path.join('bin', node_name)
			_npm = Path.join('bin', npm_name)
			runner = 'bash-runner.sh'
			runner_ext = ''
			break
		}
		case 'win32': {
			node_archive = `node-${target_version}-win-x64.7z`
			_extracted_dir = node_archive.slice(0, -3)
			extract = async (tmp_dir) => {
				await run([ zip, 'x', node_archive ], { cwd: tmp_dir })
			}
			node_name = 'node.exe'
			npm_name = 'npm.cmd'
			_node = node_name
			_npm = npm_name
			runner = 'cmd-runner.cmd'
			runner_ext = '.cmd'
			break
		}
		// No default
	}

	let tmp_dir
	try {
		// Download and extract the node binaries

		tmp_dir = await Fsp.mkdtemp(Path.join(Os.tmpdir(), 'packager-'))

		const url = `${base_url}/${target_version}/${node_archive}`
		console.error(`Downloading ${url}`)
		await download(url, tmp_dir)

		await extract(tmp_dir)

		const extracted_dir = Path.resolve(tmp_dir, _extracted_dir)
		const node = Path.join(extracted_dir, _node)
		const npm = Path.join(extracted_dir, _npm)

		// Prepare bundle

		const staging_dir = Path.join(tmp_dir, target_name)
		const bundle_dir = Path.join(staging_dir, 'bundle')
		const project_dir = Path.join(bundle_dir, 'project')
		await Fsp.mkdir(project_dir, { recursive: true })

		await Fse.copy(directory, project_dir)
		await Fse.copy(node, Path.join(bundle_dir, node_name))
		await Fsp.copyFile(
			Path.join(__dirname, '..', 'runners', runner),
			Path.join(staging_dir, `${project_name}${runner_ext}`),
		)

		// Install new node_modules

		await Fsp.rm(
			Path.join(project_dir, 'node_modules'),
			{ recursive: true, force: true },
		)
		await run([ npm, 'install' ], { cwd: project_dir })

		// Zip up everything

		await run([ zip, 'a', Path.join(target_dir, target_file), staging_dir ])
	} finally {
		try {
			await Fsp.rm(tmp_dir, { recursive: true, force: true })
		} catch (_) { }
	}
}

module.exports = { package }
