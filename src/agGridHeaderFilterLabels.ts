import type { GridApi } from 'ag-grid-community';

const FILTER_BUTTON = '.ag-header-cell-filter-button';

/** Tooltip and accessible name for an AG Grid column filter icon. */
export function headerFilterButtonLabel(columnName: string): string {
	return `Filter ${columnName}`;
}

export function labelAgGridHeaderFilterButtons(root: ParentNode): void {
	for (const button of root.querySelectorAll<HTMLElement>(FILTER_BUTTON)) {
		const cell = button.closest('.ag-header-cell');
		const name = cell
			?.querySelector('.ag-header-cell-text')
			?.textContent?.trim();
		if (!name) continue;
		const label = headerFilterButtonLabel(name);
		if (
			button.getAttribute('aria-label') === label &&
			button.title === label &&
			button.getAttribute('role') === 'button' &&
			!button.hasAttribute('aria-hidden')
		) {
			continue;
		}
		button.setAttribute('role', 'button');
		button.setAttribute('aria-label', label);
		button.title = label;
		button.removeAttribute('aria-hidden');
	}
}

function mutationTouchesHeader(mutations: MutationRecord[]): boolean {
	for (const mutation of mutations) {
		if (nodeTouchesHeader(mutation.target)) return true;
		for (const added of mutation.addedNodes) {
			if (nodeTouchesHeader(added)) return true;
		}
	}
	return false;
}

function nodeTouchesHeader(node: Node): boolean {
	const el = node instanceof Element ? node : node.parentElement;
	if (!el) return false;
	if (el.closest('.ag-header')) return true;
	return Boolean(
		el.matches('.ag-header, .ag-header-cell-filter-button') ||
			el.querySelector('.ag-header, .ag-header-cell-filter-button'),
	);
}

/** Keep filter-icon labels in sync as AG Grid recreates header cells. */
export function watchAgGridHeaderFilterButtons(api: GridApi): () => void {
	const root = api.getGridElement();
	if (!(root instanceof HTMLElement)) return () => {};

	let frame = 0;
	const run = () => {
		frame = 0;
		labelAgGridHeaderFilterButtons(root);
	};
	run();

	const observer = new MutationObserver((mutations) => {
		if (!mutationTouchesHeader(mutations)) return;
		if (frame) return;
		frame = requestAnimationFrame(run);
	});
	observer.observe(root, {
		subtree: true,
		childList: true,
		characterData: true,
	});

	return () => {
		observer.disconnect();
		if (frame) cancelAnimationFrame(frame);
	};
}
