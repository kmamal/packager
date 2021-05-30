const Fsp = require('fs/promises')
const glob = require('globby')
const Path = require('path')
const Os = require('os')
const { path7za: zip } = require('7zip-bin')
const Tar = require('tar')
const { run } = require('./run')
const { download } = require('./download')

const package = async (options) => {
	const project_path = Path.resolve(options?.project?.path ?? '.')
	const project_name = options?.project?.name ?? Path.basename(Path.dirname(project_path))
	const project_version = options?.project?.version
	const project_files = JSON.parse(options?.project?.files ?? '**/*')
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

	let _node_release_archive
	let _node_release_dir
	let extract
	let node_name
	let npm_name
	let _node
	let _npm
	let _runner_src
	let _runner_dst
	switch (target_platform) {
		case 'linux':
		case 'darwin':
		{
			_node_release_archive = `node-${target_version}-${target_platform}-x64.tar.xz`
			_node_release_dir = _node_release_archive.slice(0, -7)
			extract = async (cwd) => {
				await run([ zip, 'x', _node_release_archive ], { cwd })
				await Tar.extract({
					file: Path.join(cwd, _node_release_archive.slice(0, -3)),
					cwd,
				})
			}
			node_name = 'node'
			npm_name = 'npm'
			_node = Path.join('bin', node_name)
			_npm = Path.join('bin', npm_name)
			_runner_src = 'bash-runner.sh'
			_runner_dst = project_name
			break
		}
		case 'win32': {
			_node_release_archive = `node-${target_version}-win-x64.7z`
			_node_release_dir = _node_release_archive.slice(0, -3)
			extract = async (cwd) => {
				await run([ zip, 'x', _node_release_archive ], { cwd })
			}
			node_name = 'node.exe'
			npm_name = 'npm.cmd'
			_node = node_name
			_npm = npm_name
			_runner_src = 'cmd-runner.cmd'
			_runner_dst = `${project_name}.cmd`
			break
		}
		// No default
	}

	let tmp_dir
	try {
		tmp_dir = await Fsp.mkdtemp(Path.join(Os.tmpdir(), 'packager-'))

		console.log("Working in", tmp_dir)

		// Download and extract Node.js

		const base_url = 'https://nodejs.org/download/release'
		const url = `${base_url}/${target_version}/${_node_release_archive}`
		const download_dir = Path.join(tmp_dir, 'download')

		console.log("Downloading", url)

		const node_release_archive = Path.join(download_dir, _node_release_archive)
		await download(url, node_release_archive)
		await extract(download_dir)

		const node_release_dir = Path.resolve(download_dir, _node_release_dir)
		const node = Path.join(node_release_dir, _node)
		const npm = Path.join(node_release_dir, _npm)

		// Prepare bundle

		const staging_dir = Path.join(tmp_dir, 'stage')
		const root_dir = Path.join(staging_dir, target_name)
		const bundle_dir = Path.join(root_dir, 'bundle')
		const project_dir = Path.join(bundle_dir, 'project')
		await Fsp.mkdir(project_dir, { recursive: true })

		const promises = []
		const files = await glob(project_files, { cwd: directory })
		for (const _file of files) {
			const src = Path.join(directory, _file)
			const dst = Path.join(project_dir, _file)
			promises.push((async () => {
				await Fsp.mkdir(Path.dirname(dst), { recursive: true })
				await Fsp.copyFile(src, dst)
			})())
		}

		promises.push(Fsp.copyFile(node, Path.join(bundle_dir, node_name)))
		const runner_src = Path.join(__dirname, '..', 'runners', _runner_src)
		const runner_dst = Path.join(root_dir, _runner_dst)
		promises.push(Fsp.copyFile(runner_src, runner_dst))

		await Promise.all(promises)

		// Install new node_modules

		console.log("Installing fresh node_modules")

		await Fsp.rm(
			Path.join(project_dir, 'node_modules'),
			{ recursive: true, force: true },
		)
		await run([ npm, 'install' ], { cwd: project_dir })

		// Zip up everything

		const out_file = Path.join(target_dir, target_file)
		try { await Fsp.unlink(out_file) } catch (_) { }
		await run([ zip, 'a', out_file, root_dir ])
	} finally {
		try {
			console.log("Cleaning up")

			await Fsp.rm(tmp_dir, { recursive: true, force: true })
		} catch (_) { }
	}
}

module.exports = { package }
