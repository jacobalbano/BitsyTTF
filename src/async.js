/**
 * @global
 * @typedef {{ throwIfCancelled:() => void }} CancellationToken
 */

/**
 * @template T
 * @typedef {{stop:() => void}} Controller
 * @param {T[]} collection Collection to iterate
 * @param {(el:T, index:number, controller:Controller) => void} handler Loop body
 */
export async function longRunningLoop(collection, handler) {
	let _stop = false,
		chunkSize = 1,
		chunk = 0,
		highestGood = 1,
		lowestBad = null,
		index = 1,
		start = performance.now();
		
	const loopController = { stop() { _stop = true; } };
	for (const el of collection) {
		handler(el, index++, loopController);
		if (_stop) break;
		if (++chunk >= chunkSize) {
			chunk = 0;

			if (performance.now() - start > 32) {
				lowestBad = chunkSize;
			} else {
				highestGood = Math.max(highestGood, chunkSize);
			}

			chunkSize = (lowestBad == null)
				? chunkSize * 2
				: chunkSize = highestGood + (lowestBad - highestGood) / 2;

			await new Promise(r => setTimeout(r, 1));
			start = performance.now();
		}
	}
}

/**
 * @template T
 * @param {(ct:CancellationToken) => Promise<T>} startTask The task to start
 * @returns {{promise: Promise<T>, cancel:(() => void)}} A promise representing the task, and a function to cancel it
 */
export function task(startTask) {
	let token = false;
	let resolve = null, reject = null;
	const promise = new Promise((a, b) => [resolve, reject] = [a, b]);

	startTask({ throwIfCancelled })
		.then(x => resolve(x))
		.catch(x => reject(x));

	return { promise, cancel };

	/** Throw an exception if the task has been cancelled */
	function throwIfCancelled() {
		if (token) throw 'cancelled';
	}

	/** Cancel the task */
	function cancel() {
		token = true;
	}
}

