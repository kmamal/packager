const { spawn } = require('node:child_process')

const run = async ([ command, ...args ], options) => {
	const proc = spawn(command, args, options)

	proc.stdout.pipe(process.stdout)
	proc.stderr.pipe(process.stderr)

	await new Promise((resolve, reject) => {
		proc.on('close', (code) => {
			code ? reject(new Error(`exit code ${code}`)) : resolve()
		})
	})
}

module.exports = { run }
