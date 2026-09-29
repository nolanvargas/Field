import { describe, expect, it } from 'vitest';
import { labelAgGridHeaderFilterButtons } from '../src/agGridHeaderFilterLabels';

describe('labelAgGridHeaderFilterButtons', () => {
	it('names each header filter icon after its column', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<div class="ag-header-cell">
				<span class="ag-header-cell-filter-button" aria-hidden="true"></span>
				<span class="ag-header-cell-text">Contact</span>
			</div>
			<div class="ag-header-cell">
				<span class="ag-header-cell-filter-button" aria-hidden="true"></span>
				<span class="ag-header-cell-text">Name</span>
			</div>
		`;

		labelAgGridHeaderFilterButtons(root);

		const buttons = root.querySelectorAll<HTMLElement>(
			'.ag-header-cell-filter-button',
		);
		expect(buttons[0].getAttribute('aria-label')).toBe('Filter Contact');
		expect(buttons[0].title).toBe('Filter Contact');
		expect(buttons[0].getAttribute('role')).toBe('button');
		expect(buttons[0].hasAttribute('aria-hidden')).toBe(false);
		expect(buttons[1].getAttribute('aria-label')).toBe('Filter Name');
	});

	it('skips filter icons until the column name is available', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<div class="ag-header-cell">
				<span class="ag-header-cell-filter-button" aria-hidden="true"></span>
				<span class="ag-header-cell-text">   </span>
			</div>
		`;

		labelAgGridHeaderFilterButtons(root);

		const button = root.querySelector('.ag-header-cell-filter-button');
		expect(button?.getAttribute('aria-label')).toBeNull();
		expect(button?.hasAttribute('aria-hidden')).toBe(true);
	});
});
