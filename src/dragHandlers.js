export default (state) => ({
	over(e) {
		e.dataTransfer.dropEffect = 'copy';
		state.dragover = true;
	},

	enter() {
		state.dragover = true;
	},

	leave() {
		state.dragover = false;
	},

	drop(e) {
		state.dragover = false;
		const [file] = e.dataTransfer.files;
		state.fontFile = file;
	}
});