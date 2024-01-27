/**
 * @returns {{[id: string]: HTMLElement}} Map of element ID to element
 */
export function ids() {
	return Object.fromEntries([...document.querySelectorAll('*[id]')].map(x => [x.id, x]));
}

/**
 * @typedef {{[key: string]: any }} Globals
 */

/**
 * Do postprocessing of the HTML to add event listeners etc
 * @param {HTMLElement} root The element to begin traversal on
 * @param {Globals} globals Objects to be available to all event handlers
 */
export function wireup(root, globals) {
	const globalsKeys = Object.keys(globals), globalsArray = globalsKeys.map(x => globals[x]);
	for (const {node, postprocess} of nodesForPostprocess(root))
		postprocess(src =>  new Function(...globalsKeys, '$e', src).bind(node, ...globalsArray));
}


/**
 * Toggle classes on elements
 * @param {HTMLElement|HTMLElement[]} elements Element (or elements) to apply the classes to
 * @param {{[class: string]: boolean}} rules Apply the class [key] if the value is true
 */
export function classlist(elements, rules) {
	if (!Array.isArray(elements)) elements = [elements];
	for (const el of elements) {
		for (const key of Object.keys(rules)) {
			el.classList.toggle(key, Boolean(rules[key]));
		}
	}
}

/**
 * Set attributes on an element
 * @param {HTMLElement} element Element to apply the attributes to
 * @param {{[name: string]: string|number|boolean}} values Set the value of each property as an attribute on the element
 */
export function attrs(element, values) {
	for (const key of Object.keys(values)) {
		const value = values[key];
		if (value === false || value == null)
			element.removeAttribute(key);
		else if (value === true)
			element.setAttribute(key, '');
		else element.setAttribute(key, String(value));
	}
}

const symEvents = Symbol('events');

/**
 * @param {HTMLElement} element Element to get cached handlers on
 * @returns {{[name: string]: ((e:Event) => void)}} Handler cache
 */
function events(element) {
	const events = element[symEvents] ?? Object.defineProperty(element, symEvents, {
		enumerable: false,
		configurable: false,
		value: {},
	})[symEvents];

	return events;
}


/**
 * @param {HTMLElement} node Root node to traverse
 * @yields {HTMLElement}
 */
function* nodesForPostprocess(node) {
	if (node.attributes) {
		for (const attr of node.attributes) {
			const [,prefix, name] = attr.name.match(/^(\w+):(.+)$/u) ?? [];
			const handler = handlers[prefix];
			if (handler != null)
				yield { node, postprocess: handler(node, attr, name) };
		}
	}

	for (const child of node.childNodes) {
		for (const item of nodesForPostprocess(child))
			yield item;
	}
}

const handlers = {
	on(node, attr, name) {
		const firstDot = name.indexOf('.');
		const event = name.substring(0, firstDot < 0 ? undefined : firstDot);
		const modifiers = firstDot < 0 ? [] : name.substring(firstDot).split('.');
		const src = attr.value;
		
		return function wireEvent(parse) {
			const eventsForNode = events(node), lastHandler = eventsForNode[event];
			if (lastHandler) node.removeEventListener(event, lastHandler);
			const func = parse([...emitExtra(modifiers), src].join(';\n'));
			node.addEventListener(event, eventsForNode[event] = e => func(e));
		};
	},
	initial(node, attr, name) {
		const src = `return ${attr.value};`;
		return function bindValue(parse) {
			const func = parse(src);
			const val = func();
			node[name] = val;
		};
	}
};

/**
 * Emit extra source code for event modifiers
 * @param {string[]} modifiers Modifiers for the event
 * @yields {string} instructions
 */
function* emitExtra(modifiers) {
	for (const mod of modifiers.filter(x => x)) {
		switch (mod) {
			case 'blur': yield '$e.target.blur && $e.target.blur()'; break;
			case 'stop': yield '$e.stopPropagation()'; break;
			case 'prevent': yield '$e.preventDefault()'; break;
			default: console.warn(`cannot emit instruction "${mod}"`);
		}
	}
}