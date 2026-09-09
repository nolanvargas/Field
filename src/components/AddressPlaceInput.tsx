import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Alert, Autocomplete, Text } from '@mantine/core';
import { MapPin } from 'lucide-react';
import {
	autocompletePlaces,
	getPlaceDetails,
	type PlaceDetails,
} from '../api/places';

export interface ResolvedPlace {
	streetLine: string;
	addressName?: string;
	latitude: number;
	longitude: number;
	googlePlaceId: string;
	formattedAddress: string;
}

interface AddressPlaceInputProps {
	label?: string;
	placeholder?: string;
	streetLine: string;
	addressName?: string;
	building?: string;
	disabled?: boolean;
	required?: boolean;
	/** Existing coords when editing a geocoded row. */
	initialResolved?: ResolvedPlace | null;
	onStreetLineChange: (value: string) => void;
	onResolved: (place: ResolvedPlace | null) => void;
}

function createSessionToken() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toResolvedPlace(
	details: PlaceDetails,
	typed: { streetLine: string; addressName?: string },
): ResolvedPlace {
	const typedStreet = typed.streetLine.trim();
	const typedName = typed.addressName?.trim() ?? '';
	return {
		streetLine:
			details.formattedStreetLine?.trim() ||
			details.formattedAddress.trim() ||
			typedStreet,
		addressName: typedName || details.displayName || undefined,
		latitude: details.latitude,
		longitude: details.longitude,
		googlePlaceId: details.placeId,
		formattedAddress: details.formattedAddress,
	};
}

export function AddressPlaceInput({
	label = 'Street',
	placeholder = 'Search street address',
	streetLine,
	addressName = '',
	building: _building = '',
	disabled = false,
	required = false,
	initialResolved = null,
	onStreetLineChange,
	onResolved,
}: AddressPlaceInputProps) {
	const inputId = useId();
	const [options, setOptions] = useState<{ value: string; label: string }[]>(
		[],
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resolved, setResolved] = useState<ResolvedPlace | null>(
		initialResolved,
	);
	const sessionTokenRef = useRef(createSessionToken());
	const abortRef = useRef<AbortController | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setResolved(initialResolved);
	}, [initialResolved]);

	const resetSession = useCallback(() => {
		sessionTokenRef.current = createSessionToken();
	}, []);

	const clearResolved = useCallback(() => {
		setResolved(null);
		onResolved(null);
	}, [onResolved]);

	const handleInputChange = (value: string) => {
		onStreetLineChange(value);
		if (resolved && value.trim() !== resolved.streetLine.trim()) {
			clearResolved();
		}
		setError(null);

		if (debounceRef.current) clearTimeout(debounceRef.current);
		const trimmed = value.trim();
		if (trimmed.length < 3) {
			setOptions([]);
			return;
		}

		debounceRef.current = setTimeout(() => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;
			setLoading(true);
			void autocompletePlaces(
				trimmed,
				sessionTokenRef.current,
				controller.signal,
			)
				.then((suggestions) => {
					if (controller.signal.aborted) return;
					setOptions(
						suggestions.map((item) => ({
							value: item.placeId,
							label: item.label,
						})),
					);
				})
				.catch((err: unknown) => {
					if (controller.signal.aborted) return;
					setOptions([]);
					setError(
						err instanceof Error
							? err.message
							: 'Address search failed',
					);
				})
				.finally(() => {
					if (!controller.signal.aborted) setLoading(false);
				});
		}, 250);
	};

	const handleOptionSubmit = async (placeId: string) => {
		const option = options.find((item) => item.value === placeId);
		if (!option) return;

		setLoading(true);
		setError(null);
		try {
			const details = await getPlaceDetails(
				placeId,
				sessionTokenRef.current,
			);
			const next = toResolvedPlace(details, { streetLine, addressName });
			setResolved(next);
			onStreetLineChange(next.streetLine);
			onResolved(next);
			resetSession();
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : 'Could not load place details',
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	return (
		<>
			<Autocomplete
				id={inputId}
				size='sm'
				label={label}
				placeholder={placeholder}
				value={streetLine}
				data={options}
				filter={({ options: current }) => current}
				onChange={handleInputChange}
				onOptionSubmit={handleOptionSubmit}
				leftSection={<MapPin size={16} />}
				required={required}
				disabled={disabled}
				rightSection={loading ? <Text fz={11}>…</Text> : null}
			/>
			{error ? (
				<Alert color='red' mt={6} py={6}>
					{error}
				</Alert>
			) : null}
		</>
	);
}
