const Https = require('https')
const Stream = require('stream')
const Util = require('util')
const Fs = require('fs')
const Fsp = require('fs/promises')
const Path = require('path')

const promisePipeline = Util.promisify(Stream.pipeline)

const download = async (url, dst) => {
	const request = Https.get(url)
	const response = await new Promise((resolve, reject) => {
		request
			.on('response', resolve)
			.on('error', reject)
	})

	await Fsp.mkdir(Path.dirname(dst), { recursive: true })

	await promisePipeline(
		response,
		Fs.createWriteStream(dst),
	)
}

module.exports = { download }
