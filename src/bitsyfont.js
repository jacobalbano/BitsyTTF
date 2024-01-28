import { Font } from "opentype.js";
import { longRunningLoop } from "./async";
import { renderChar, lum } from "./rendering";

/**
 * @async
 * @param {import("./async").CancellationToken} ct Cancellation token
 * @param {string} name Font name
 * @param {object} state Structured parameter
 * @param {boolean} state.doRestrict Whether the font should only contain characters from the restrict text
 * @param {string} state.restrictText Characters to restrict the font to
 * @param {Font} state.font The font to render
 * @param {number} state.fontSize Font size in pixels
 * @param {number} state.minWhite Aliasing threshold (white)
 * @param {number} state.maxBlack Aliasing threshold (black)
 * @returns {string} The constructed bitsyfont
 */
export async function generateBitsyFont(ct, name, { doRestrict, restrictText, font, fontSize, minWhite, maxBlack}) {
	const codepoints = () => doRestrict
		? [...new Set(restrictText)].map(x => x.codePointAt(0))
		: yieldGlyphCodePoints(font);


	let width = 0, height = 0;
	const glyphs = [];
	await longRunningLoop(codepoints(), cp => {

		const char = String.fromCodePoint(cp);
		const canvas = renderChar(char, font, fontSize, minWhite, maxBlack);
		const ctx = canvas.getContext('2d', { willReadFrequently: true });

		const glyph = {cp, lines: []};
		glyphs.push(glyph);

		for (let y = 0; y < canvas.height; y++) {
			const line = [];
			glyph.lines.push(line);

			for (let x = 0; x < canvas.width; x++) {
				const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
				const lumValue = lum(r, g, b);
				line.push(Number(lumValue === 0));
			}
			
			const lastOne = line.lastIndexOf(1) ;
			width = Math.max(width, lastOne + 1);
			if (lastOne >= 0)
				height = Math.max(height, y + 1);
		}

		ct.throwIfCancelled();
	});

	const sections = [
		`FONT ${name}`,
		`SIZE ${width} ${height}`
	];

	for (const {cp, lines} of glyphs) {
		sections.push(`CHAR ${cp}`);
		for (let row = 0; row < height; row++) {
			const line = lines[row];
			line.length = width;
			sections.push(line.join('')
				// .replaceAll('1', '█')
				// .replaceAll('0', '░')
			);
		}
	}

	return sections.join('\n');
}

/**
 * @param {Font} font Structured parameter
 * @param {import("opentype.js").GlyphSet} font.glyphs Glyphs
 * @yields {number} Code point 
 */
function* yieldGlyphCodePoints({glyphs}) {
	for (let i = 0; i < glyphs.length; ++i) {
		const { unicode } = glyphs.get(i);
		if (unicode) yield unicode;
	}
}