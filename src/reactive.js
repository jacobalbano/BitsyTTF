/**
 * @callback ChangeHandler
 * @param {any} value
 * @param {any} old
 * @param {string} key
 * @returns {void}
 */
/**
 * @callback Unsub
 * @returns {void}
 */
/**
 * @callback Watcher
 * @param {string|string[]} keys
 * @param {ChangeHandler} handler
 * @returns {Unsub}
 */
/**
 * @template {{[key: string]: any}} T
 * @param {T} definition An object defining the reactive state
 * @returns {{state: T, watch:Watcher}} The reactive state
 */
export default function reactive(definition) {
	definition = structuredClone(definition);
	let nextWatcher = 1;
	const state = {}, 
	watchers = {};
	for (const key of Object.keys(definition)) {
		const keyWatchers = watchers[key] = {};
		Object.defineProperty(state, key, {
			get() { return definition[key]; },
			set(value) {
				const old = definition[key];
				definition[key] = value;
				notify(keyWatchers, value, old, key);
			}
		});
	}

	return { state, watch };

	/**
	 * @param {{[id: string]: ChangeHandler}} watchers Watchers for this property
	 * @param {any} value The new value
	 * @param {any} old The previous value
	 * @param {string} key This property's name
	 */
	function notify(watchers, value, old, key) {
		for (const handlerKey of Object.keys(watchers)) {
			watchers[handlerKey](value, old, key);
		}
	}

	/**
	 * @type {Watcher}
	 */
	function watch(props, handler) {
		const unsub = [];
		if (!Array.isArray(props))
			props = [props];

		for (const prop of props) {
			const keyWatchers = watchers[prop];
			const watcherId = String(++nextWatcher);
			unsub.push({ prop, watcherId });
			keyWatchers[watcherId] = handler;
		}

		return () => {
			for (const { prop, watcherId } of unsub) {
				const keyWatchers = watchers[prop];
				delete keyWatchers[watcherId];
			}
		};
	}
}
