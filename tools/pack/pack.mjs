import fs from 'fs/promises';
import process from 'process';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import fetch from 'node-fetch';

const files = (await spread(walk('dist')))
	.filter(x => !x.match(/((\.js\.map)|(\.zip))$/u));

const dist = new JSZip();
for (const file of files)
	dist.file(file.substring('dist/'.length), fs.readFile(file));

const buffer = await dist.generateAsync({ type: 'nodebuffer'});
await fs.writeFile('dist/dist.zip', buffer);

const pkg = JSON.parse(await fs.readFile('package.json'));
const {version, name} = pkg;
const {channel, username} = pkg.config;
const target = `${username}/${name}`;

const {latest} = await fetch(`https://itch.io/api/1/x/wharf/latest?target=${target}&channel_name=${channel}`)
	.then(x => x.json());

if (latest === version)
	throw 'version number matches remote! increment the package version before pushing';

await ensureButler();
console.log('process returned ', await run('tools/butler/butler.exe', [
	'push',
	'dist/dist.zip',
	`${target}:${channel}`,
	'--userversion',
	version,
]));

/**
 * @param {string} exe Path to EXE
 * @param {string[]} args Args
 * @returns {Promise<number>} Result code
 */
function run(exe, args) {
	const proc = spawn(path.normalize(exe), args);
	proc.stderr.pipe(process.stderr);
	proc.stdout.pipe(process.stdout);
	return new Promise(r => proc.on('exit', code => r(code)));
}

/**
 * @returns {Promise<void>}
 */
async function ensureButler() {
	const stat = await fs.stat('tools/butler/butler.exe');
	if (stat.isFile()) return;

	const url = await fs.readFile('tools/butler/put_butler_here');
	const resp = await fetch(url);
	const zip = await JSZip.loadAsync(resp.arrayBuffer());

	await Promise.all(
		Object.keys(zip.files)
			.map(name => ({ name, buffer: zip.file(name).async('nodebuffer') }))
			.map(async ({name, buffer}) => fs.writeFile(`tools/butler/${name}`, await buffer))
	);
}

/**
 * @template T 
 * @param {Promise<T[]>} asyncIterator Iterator
 * @returns {Promise<T[]>} Results
 */
async function spread(asyncIterator) {
	const result = [];
	for await (const x of asyncIterator)
		result.push(x);
	return result;
}

/**
 * @param {string} dir Start directory
 * @yields {string}
 * @returns {Promise<string[]>} Iterator over files
 */
async function* walk(dir) {
	const files = await fs.readdir(dir);

	for (const file of files) {
		const filepath = path.join(dir, file);
		const stat = await fs.stat(filepath);

		if (stat.isDirectory()) {
			yield* await walk(filepath);
		} else {
			yield path.join(dir, file);
		}
	}
}