import { describe, expect, it } from 'vitest';
import { pinAdjustIntroText } from '../src/components/AddressPinModal';

describe('pinAdjustIntroText', () => {
	it('uses delivery wording for Delivery tasks', () => {
		expect(pinAdjustIntroText('Delivery')).toBe(
			'Move the map so the pin marks the exact delivery point.',
		);
	});

	it('uses generic location wording for other task types', () => {
		expect(pinAdjustIntroText('Pickup')).toBe(
			'Move the map so the pin marks the exact location.',
		);
	});

	it('uses generic location wording when task type is omitted', () => {
		expect(pinAdjustIntroText()).toBe(
			'Move the map so the pin marks the exact location.',
		);
		expect(pinAdjustIntroText(null)).toBe(
			'Move the map so the pin marks the exact location.',
		);
	});
});
