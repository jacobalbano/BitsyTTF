import { Font } from "opentype.js";

/**
 * @param {number} r Red (0..255)
 * @param {number} g Green (0..255)
 * @param {number} b Blue (0..255)
 * @returns {number} Luminance
 */
export const lum = (r, g, b) =>  (0.2126*r + 0.7152*g + 0.0722*b) | 0;

export const fontOptions = Object.freeze({
	kerning: false,
	hinting: false,
	features: { liga: false, rlig: false }
});

/**
 * @param {{font: Font, sampleText: string, fontSize: number}} state State variables
 * @param {HTMLDivElement} preview The container of the preview canvas (for setting size)
 * @param {HTMLCanvasElement} previewCanvas The preview canvas
 */
export function redrawPreview({ font, sampleText, fontSize, minWhite, maxBlack }, preview, previewCanvas) {
	previewCanvas.width = preview.clientWidth;
	previewCanvas.height = preview.clientHeight;
	clear(previewCanvas);
	
	if (font == null) return;
	const context = previewCanvas.getContext('2d');
	const scale = 4;
	context.scale(scale, scale);

	for (const line of sampleText.split('\n')) {
		if (line) {
			const baseline = ((font.ascender / font.unitsPerEm) + (font.descender / font.unitsPerEm)) * fontSize;
			const offscreen = renderWithThreshold(line, font, fontSize, baseline, maxBlack, minWhite );
			context.drawImage(offscreen, 0, 2, offscreen.width, offscreen.height);
		}
		context.translate(0, fontSize);
	}
}
/**
 * @param {string} string String to render
 * @param {Font} font Font to render with
 * @param {number} fontSize Font size
 * @returns {number} baseline
 */
export function getBaseline(string, font, fontSize) {
	const path = font.getPath(string, 0, 0, fontSize, fontOptions);
	const bbox = path.getBoundingBox();
	return fontSize - bbox.y2;
}

/**
 * 
 * @param {string} string String to render
 * @param {Font} font Font to render with
 * @param {number} fontSize Font size
 * @param {number} baseline Baseline to render at (since individual glyphs have their own values)
 * @param {number} black Anything under this number is clamped to black
 * @param {number} white Anything above this number is clamped to white
 * @returns {HTMLCanvasElement} Canvas
 */
export function renderWithThreshold(string, font, fontSize, baseline, black, white) {
	const path = font.getPath(string, 0, baseline, fontSize, fontOptions);
	const offscreen = document.createElement('canvas');
	offscreen.width = Math.max(font.getAdvanceWidth(string, fontSize) + fontSize, fontSize);
	offscreen.height = fontSize;
	const offscreenCtx = offscreen.getContext('2d');
	offscreenCtx.imageSmoothingEnabled = false;
	offscreenCtx.fillStyle = 'white';
	offscreenCtx.fillRect(0, 0, offscreen.width, offscreen.height);
	path.draw(offscreenCtx);

	const imageData = offscreenCtx.getImageData(0, 0, offscreen.width, offscreen.height);
	const { data } = imageData;
	for	(let i = 0; i < data.length; i += 4) {
		const color = lum(data[i], data[i+1], data[i+2]);
		if (color < black)
			data[i] = data[i+1] = data[i+2] = 0;
		else if (color > white)
			data[i] = data[i+1] = data[i+2] = 255;
	}

	offscreenCtx.putImageData(imageData, 0, 0);
	return offscreen;
}

/**
 * @param {HTMLCanvasElement} previewCanvas Canvas
 */
export function clear(previewCanvas) {
	const context = previewCanvas.getContext('2d');
	context.fillStyle = 'white';
	context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
	context.imageSmoothingEnabled = false;
	context.setTransform(1, 0, 0, 1, 0, 0);
}