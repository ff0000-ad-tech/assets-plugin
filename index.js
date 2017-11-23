const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const mkdirp = require('mkdirp');

const fbaCompiler = require('fba-compiler');
const copier = require('./lib/copier.js');

const debug = require('debug');
var log = debug('wp-plugin-assets');


function AssetsPlugin(deploy, options) {
	this.deploy = deploy;
	this.options = options;
	/** TODO 
			Document `this.options`:

			this.options = {
				assets: [
					{
						sources: [
							list of asset paths
						],
						from: './source-context',
						to: './destination-context',
						// output from wp-plugin-payload 
						payload: {
							recompile: true/false,
							modules: [
								Webpack modules to compile
							]
						},
						disable: true/false (switch to stop this asset-group from processing, either copying or compiling)
					}
				]
			}
	*/
}


AssetsPlugin.prototype.apply = function(compiler) {
	compiler.plugin('emit', (compilation, callback) => {
		log(this.options);

		// prepare destination folders
		prepareDeploy(this.deploy);

		var promises = [];
		var fbaAssets = [];
		// iterate assets
		this.options.assets.forEach((asset) => {
			// fba-compile if asset has payload representation, and it is not disabled
			if (asset.payload && !asset.payload.disabled) {
				if (asset.payload.type == 'fba') {
					asset.payload.modules.forEach((mod) => {
						fbaAssets.push({
							chunkType: asset.payload.chunkType,
							path: mod.userRequest
						});
					});
				}
			}
			// otherwise copy the asset to deploy
			else {
				promises.push(
					copier.copy(asset)
				);				
			}
		});
		// TODO: have this be part of the promise-chain
		promises.push(
			fbaCompiler.compile({
				target: `${this.deploy.output.fba.path}/${this.deploy.output.fba.filename}`,
				assets: fbaAssets
			})
		);
		// TODO: <img> and background-image declarations would have to be rewritten to payload blobs

		// return to webpack flow
		Promise.all(promises).then(() => {
			callback();
		})
		.catch((err) => {
			log(err);
		});		
	});
};



function prepareDeploy(deploy) {
	if (!fs.existsSync(deploy.env.context.deploy)) {
		mkdirp.sync(deploy.env.context.deploy);
	}
}

module.exports = AssetsPlugin;