import { describe, expect, it } from 'vitest';
import type { Address } from '../src/api/addresses';
import {
	addressToFormValues,
	formValuesToAddressPayload,
} from '../src/addresses';
import type { NewAddressFormValues } from '../src/components/NewAddressModal';

const sampleAddress: Address = {
	id: 9,
	addressName: 'Warehouse A',
	streetLine: '100 Main St',
	building: 'Dock 3',
	notes: 'Ring bell',
	latitude: -33.86,
	longitude: 151.2,
	googlePlaceId: 'place-abc',
	customFields: { '1': 'North' },
};

describe('addressToFormValues', () => {
	it('maps API address fields into form values', () => {
		expect(addressToFormValues(sampleAddress)).toEqual({
			addressName: 'Warehouse A',
			streetLine: '100 Main St',
			building: 'Dock 3',
			notes: 'Ring bell',
			latitude: -33.86,
			longitude: 151.2,
			googlePlaceId: 'place-abc',
			customFields: { '1': 'North' },
		});
	});

	it('copies customFields so edits do not mutate the source', () => {
		const form = addressToFormValues(sampleAddress);
		form.customFields['2'] = 'added';
		expect(sampleAddress.customFields).toEqual({ '1': 'North' });
	});
});

describe('formValuesToAddressPayload', () => {
	it('trims strings and omits blank optional fields', () => {
		const values: NewAddressFormValues = {
			addressName: '  Site B  ',
			streetLine: ' 200 King St ',
			building: '   ',
			notes: '',
			latitude: null,
			longitude: null,
			googlePlaceId: null,
			customFields: {},
		};

		expect(formValuesToAddressPayload(values)).toEqual({
			addressName: 'Site B',
			streetLine: '200 King St',
			latitude: null,
			longitude: null,
			googlePlaceId: null,
			customFields: {},
		});
	});

	it('round-trips trimmed values back to create payload', () => {
		const payload = formValuesToAddressPayload(addressToFormValues(sampleAddress));
		expect(payload).toEqual({
			addressName: 'Warehouse A',
			streetLine: '100 Main St',
			building: 'Dock 3',
			notes: 'Ring bell',
			latitude: -33.86,
			longitude: 151.2,
			googlePlaceId: 'place-abc',
			customFields: { '1': 'North' },
		});
	});
});
