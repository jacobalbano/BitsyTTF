import fs from 'fs/promises';
import process from 'process';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';

const files = (await spread(walk('dist')))
	.filter(x => !x.match(/((\.js\.map)|(\.zip))$/u));
const dist = new JSZip();
for (const file of files) {
	const data = await fs.readFile(file);
	dist.file(file.substring('dist/'.length), data);
}

const buffer = await dist.generateAsync({ type: 'nodebuffer'});
await fs.writeFile('dist/dist.zip', buffer);

const pkg = JSON.parse(await fs.readFile('package.json'));
const buildNum = pkg.version;

console.log('process returned ', await run('tools/butler/butler.exe', [
	'push',
	'dist/dist.zip',
	'jacobalbano/bitsyttf:web',
	'--userversion',
	buildNum,
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