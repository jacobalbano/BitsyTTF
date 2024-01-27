import htmlTemplate from 'rollup-plugin-generate-html-template';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import css from "rollup-plugin-import-css";
import pkg from './package.json' assert { type: 'json' }
import commonjs from '@rollup/plugin-commonjs';
import { argv } from 'process';

const minify = argv.includes('--config-minify');
const watch = argv.includes('--watch');

export default [{
    input: 'src/index.js',
    output: {
        file: `dist/${pkg.name}_bundle.js`,
        format: 'iife',
        name: 'app',
        sourcemap: true,
    },
    plugins: [
        htmlTemplate({
            template: 'src/index.html',
            target: 'index.html'
        }),
		watchExtra(['src/index.html']),
		nodeResolve(),
		commonjs(),
		...when(minify, [terser()]),
		...when(watch, [serve('dist')]),
		css({ output: 'style/bundle.css', minify }),
        copy({
            targets: [{
                src: 'src/style/material-symbols-outlined.woff2',
                dest: 'dist/style/',
            }],
        }),
    ],
}];

function* when(condition, plugins) {
	if (condition) {
		for (const plugin of plugins) yield plugin;
	}
}

function watchExtra(files) {
    return {
        name: 'watch-index',
        buildStart() {
            for (const file of files)
				this.addWatchFile(file);
        },
    }
}