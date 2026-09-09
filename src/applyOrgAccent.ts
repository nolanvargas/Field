import { accentCssText, DEFAULT_ACCENT } from '../shared/orgAccent.js';

const STYLE_ID = 'field-org-accent';

/** Inject derived accent tokens (Field CSS + Mantine brand scale) on the document. */
export function applyOrgAccent(value: unknown = DEFAULT_ACCENT): void {
	if (typeof document === 'undefined') return;
	let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement('style');
		el.id = STYLE_ID;
		document.head.appendChild(el);
	}
	el.textContent = accentCssText(value);
	document.head.appendChild(el);
}
