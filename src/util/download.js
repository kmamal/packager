const Https = require('node:https')
const Stream = require('node:stream')
const Util = require('node:util')
const Fs = require('node:fs')
const Path = require('node:path')

const promisePipeline = Util.promisify(Stream.pipeline)

const download = async (url, dst) => {
	const request = Https.get(url)
	const response = await new Promise((resolve, reject) => {
		request
			.on('response', resolve)
			.on('error', reject)
	})

	const { statusCode } = response
	if (!(200 <= statusCode && statusCode < 300)) {
		throw new Error(`bad status code ${statusCode}`)
	}

	await Fs.promises.mkdir(Path.dirname(dst), { recursive: true })

	await promisePipeline(
		response,
		Fs.createWriteStream(dst),
	)
}

module.exports = { download }
