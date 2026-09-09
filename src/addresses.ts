import type { Address, CreateAddressInput } from './api/addresses';
import type { NewAddressFormValues } from './components/NewAddressModal';

export function addressToFormValues(address: Address): NewAddressFormValues {
	return {
		addressName: address.addressName,
		streetLine: address.streetLine,
		building: address.building,
		notes: address.notes,
		latitude: address.latitude,
		longitude: address.longitude,
		googlePlaceId: address.googlePlaceId,
		customFields: { ...address.customFields },
	};
}

export function formValuesToAddressPayload(
	values: NewAddressFormValues,
): CreateAddressInput {
	return {
		addressName: values.addressName.trim() || undefined,
		streetLine: values.streetLine.trim(),
		building: values.building.trim() || undefined,
		notes: values.notes.trim() || undefined,
		latitude: values.latitude,
		longitude: values.longitude,
		googlePlaceId: values.googlePlaceId,
		customFields: values.customFields,
	};
}
