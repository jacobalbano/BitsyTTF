import { saveAs } from 'file-saver';
import reactive from './reactive';
import { parse } from 'opentype.js';
import {redrawPreview, clear} from './rendering';
import dragHandlers from './dragHandlers';
import { generateBitsyFont } from './bitsyfont';
import 'beercss';
import './style/app.css';

import { ids, wireup, classlist, attrs } from './ez';
import { task } from './async.js';

const {
	sizeSlider,
	sizeText,
	blackText, whiteText,
	blackRange, whiteRange,
	sampleText,
	fontName,
	dropzone,
	preview,
	previewCanvas,
	unload,
	save,
	error,
} = ids();

const {state, watch} = reactive({
	fontSize: 16,
	threshold: 128,
	minWhite: 192,
	maxBlack: 64,
	doRestrict: false,
	restrictText: '',
	sampleText: 'the quick brown fox jumps over the lazy dog',
	
	/**@type {File}**/
	fontFile: null,

	/**@type {Font} */
	font: null,

	dragover: false,
	processing: false,
	error: false,
});

/**
 * 
 * @param {number} value value
 * @param {number} min min
 * @param {number} max max
 * @returns {number} clamped value
 */
function clamp(value, min, max) {
	return Math.min(Number(max), Math.max(Number(min), Number(value)));
}

wireup(document, {
	state,
	drag: dragHandlers(state),
	clampWhite(value) {
		return clamp(value, state.maxBlack + 5, 254);
	},
	clampBlack(value) {
		return clamp(value, 0, state.minWhite - 5);
	},
	clamp(value, {min, max}) {
		return Math.min(Number(max), Math.max(Number(min), value));
	},
	async onSave() {
		if (state.processing) {
			state.cancel();
			state.processing = false;
			return;
		} 

		const release = createNavigationLock();
		state.processing = true;
		try {
			const {fontFile} = state;
			const [name] = fontFile.name.match(/^([^.]+)/u) ?? [fontFile.name];
			const { cancel, promise } = task(ct => 
				generateBitsyFont(ct, name, state)
			);
	
			state.cancel = cancel;
			saveAs(new Blob([await promise], {type: "text/plain;charset=utf-8"}), `${name}.bitsyfont`);	
		} catch (error) {
			if (error != 'cancelled') {
				state.error = true;
				setTimeout(() => state.error = false, 6000);
			}
		}

		release();
		state.processing = false;
	},
});

window.addEventListener('resize', () => redrawPreview(state, preview, previewCanvas));

watch('fontFile', async file => {
	classlist([unload, preview], { hidden: file == null });
	classlist(dropzone, { hidden: file != null });
	attrs(save, { disabled: file == null });
	clear(previewCanvas);
	
	if (file == null)
		return;

	fontName.innerText = file.name;
	state.font = parse(await file.arrayBuffer());
});

watch(['fontSize'], value => {
	const min = Number(sizeSlider.min), max = Number(sizeSlider.max);
	sizeSlider.value = sizeText.value = Math.max(min, Math.min(value, max));
});

watch('sampleText', value => sampleText.value = value);
watch(['fontSize', 'sampleText', 'font', 'minWhite', 'maxBlack'], () => redrawPreview(state, preview, previewCanvas));
watch(['dragover'], value => dropzone.classList.toggle('drag-active', value));
watch('processing', busy => classlist(save, { busy }));
watch('error', active => classlist(error, { active }));
watch('maxBlack', value => blackRange.value = blackText.value = value);
watch('minWhite', value => whiteRange.value = whiteText.value = value);

/**
 * Create a navigation lock
 * @returns {() => void} Release the lock
 */
function createNavigationLock() {
	const beforeUnloadListener = (event) => {
		event.preventDefault();
		return event.returnValue = '';
	};

	addEventListener('beforeunload', beforeUnloadListener, { capture: true });
	return () => removeEventListener('beforeunload', beforeUnloadListener, { capture: true });
}