import { Font } from "opentype.js";
import { longRunningLoop } from "./async";
import { renderWithThreshold, lum, getBaseline } from "./rendering";

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
	const sections = [];
	const codepoints = () => doRestrict
		? [...new Set(restrictText)].map(x => x.codePointAt(0))
		: yieldGlyphCodePoints(font);

	let commonBaseline = fontSize;
	await longRunningLoop(codepoints(), cp => {
		const char = String.fromCodePoint(cp);
		commonBaseline = Math.min(commonBaseline, getBaseline(char, font, fontSize));
	});

	let width = 0, height = 0;
	await longRunningLoop(codepoints(), cp => {
		sections.push(`CHAR ${cp}`);

		const char = String.fromCodePoint(cp);
		const canvas = renderWithThreshold(char, font, fontSize, commonBaseline, minWhite, maxBlack);
		const ctx = canvas.getContext('2d');

		for (let y = 0; y < fontSize; y++) {
			const line = [];
			for (let x = 0; x < fontSize; x++) {
				const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
				const lumValue = lum(r, g, b);
				line.push(Number(lumValue == 0));
			}
			
			const lastOne = line.lastIndexOf(1);
			width = Math.max(width, lastOne);
			if (lastOne >= 0)
				height = Math.max(height, y);

			sections.push(line.join('')
				// .replaceAll('1', '█')
				// .replaceAll('0', '░')
			);
		}

		ct.throwIfCancelled();
	});

	sections.splice(0, 0, 
		`FONT ${name}`,
		`SIZE ${Math.min(width + 1, fontSize)} ${Math.min(height + 1, fontSize)}`
	);
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