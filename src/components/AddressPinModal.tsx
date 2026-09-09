import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Box,
	Button,
	Group,
	Loader,
	SimpleGrid,
	Stack,
	Text,
} from '@mantine/core';
import { MapPin, Navigation, Save } from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { patchAddressCoordinates } from '../api/addresses';
import { patchTaskDestinationCoordinates } from '../api/tasks';
import { fetchViewportHint, type ViewportHint } from '../api/places';
import { AddressMapPreview } from './AddressMapPreview';
import { MapInvalidateSize, MapRecenter } from './addressMapUtils';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [36.1699, -115.1398];
const MANUAL_ZOOM = 14;
const VERIFY_ZOOM = 18;

function MapCenterTracker({
	onChange,
}: {
	onChange: (lat: number, lng: number) => void;
}) {
	const map = useMap();
	useEffect(() => {
		const update = () => {
			const next = map.getCenter();
			onChange(next.lat, next.lng);
		};
		map.on('move', update);
		update();
		return () => {
			map.off('move', update);
		};
	}, [map, onChange]);
	return null;
}

export type AddressPinModalProps = {
	label: string;
	addressName?: string;
	streetLine?: string;
	building?: string;
	opened: boolean;
	onClose: () => void;
	initialLatitude?: number | null;
	initialLongitude?: number | null;
	zIndex?: number;
} & (
	| {
			mode: 'address';
			id: number;
			onSaved: () => void | Promise<void>;
	  }
	| {
			mode: 'task';
			id: number;
			onSaved: () => void | Promise<void>;
	  }
	| {
			mode: 'draft';
			onSaved: (
				latitude: number,
				longitude: number,
				googlePlaceId?: string | null,
			) => void | Promise<void>;
	  }
);

type ModalPhase = 'loading' | 'verify' | 'manual' | 'adjust';

type GoogleMatch = Pick<
	ViewportHint,
	| 'latitude'
	| 'longitude'
	| 'googlePlaceId'
	| 'formattedAddress'
	| 'formattedStreetLine'
	| 'displayName'
> & {
	latitude: number;
	longitude: number;
};

function formatPinModalTitle(
	addressName: string,
	streetLine: string,
	building: string,
	fallbackLabel: string,
) {
	const parts = [addressName, building, streetLine]
		.map((part) => part.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts.join(', ') : fallbackLabel || 'Geo-locate';
}

function onFileContextLines(addressName: string, building: string) {
	const lines: { label: string; value: string }[] = [];
	const name = addressName.trim();
	const bldg = building.trim();
	if (name) lines.push({ label: 'Name', value: name });
	if (bldg) lines.push({ label: 'Building', value: bldg });
	return lines;
}

function googleStreetLine(match: GoogleMatch) {
	return (
		match.formattedAddress?.trim() ||
		match.formattedStreetLine?.trim() ||
		'—'
	);
}

function AddressValueBlock({ title, value }: { title: string; value: string }) {
	return (
		<Stack gap={4}>
			<Text fz={11} c='dimmed' fw={600} tt='uppercase'>
				{title}
			</Text>
			<Text fz={14} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
				{value}
			</Text>
		</Stack>
	);
}

function AddressCompareColumn({
	title,
	lines,
}: {
	title: string;
	lines: { label: string; value: string }[];
}) {
	return (
		<Stack gap={6}>
			<Text fz={11} c='dimmed' fw={600} tt='uppercase'>
				{title}
			</Text>
			{lines.map((line) => (
				<Box key={line.label}>
					<Text fz={11} c='dimmed'>
						{line.label}
					</Text>
					<Text fz={14} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
						{line.value}
					</Text>
				</Box>
			))}
		</Stack>
	);
}

export function AddressPinModal(props: AddressPinModalProps) {
	const {
		label,
		addressName = '',
		streetLine = '',
		building = '',
		opened,
		onClose,
		initialLatitude = null,
		initialLongitude = null,
		zIndex,
	} = props;
	const [phase, setPhase] = useState<ModalPhase>('loading');
	const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
	const [pin, setPin] = useState<[number, number]>(DEFAULT_CENTER);
	const [googleMatch, setGoogleMatch] = useState<GoogleMatch | null>(null);
	const [locating, setLocating] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasInitialCoords =
		initialLatitude != null && initialLongitude != null;
	const title = useMemo(
		() => formatPinModalTitle(addressName, streetLine, building, label),
		[addressName, streetLine, building, label],
	);
	const onFileContext = useMemo(
		() => onFileContextLines(addressName, building),
		[addressName, building],
	);
	const googleStreet = googleMatch ? googleStreetLine(googleMatch) : '—';

	const handlePinChange = useCallback((lat: number, lng: number) => {
		setPin([lat, lng]);
	}, []);

	const loadInitialCenter = useCallback(async () => {
		setPhase('loading');
		setGoogleMatch(null);
		setError(null);
		try {
			if (hasInitialCoords) {
				const next: [number, number] = [
					initialLatitude as number,
					initialLongitude as number,
				];
				setCenter(next);
				setPin(next);
				setPhase('adjust');
				return;
			}
			if (!addressName.trim() && !streetLine.trim()) {
				setCenter(DEFAULT_CENTER);
				setPin(DEFAULT_CENTER);
				setPhase('manual');
				return;
			}

			const hint = await fetchViewportHint({
				addressName,
				streetLine,
				building,
			});
			if (hint.latitude != null && hint.longitude != null) {
				const next: [number, number] = [hint.latitude, hint.longitude];
				setCenter(next);
				setPin(next);
				setGoogleMatch({
					latitude: hint.latitude,
					longitude: hint.longitude,
					googlePlaceId: hint.googlePlaceId,
					formattedAddress: hint.formattedAddress,
					formattedStreetLine: hint.formattedStreetLine,
					displayName: hint.displayName,
				});
				setPhase('verify');
				return;
			}
			setCenter(DEFAULT_CENTER);
			setPin(DEFAULT_CENTER);
			setPhase('manual');
		} catch (err: unknown) {
			setCenter(DEFAULT_CENTER);
			setPin(DEFAULT_CENTER);
			setPhase('manual');
			setError(
				err instanceof Error ? err.message : 'Could not look up address',
			);
		}
	}, [
		addressName,
		streetLine,
		building,
		hasInitialCoords,
		initialLatitude,
		initialLongitude,
	]);

	useEffect(() => {
		if (!opened) return;
		void loadInitialCenter();
	}, [opened, loadInitialCenter]);

	const useMyLocation = () => {
		if (!navigator.geolocation) {
			setError('Location is not available in this browser');
			return;
		}
		setLocating(true);
		setError(null);
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setCenter([
					position.coords.latitude,
					position.coords.longitude,
				]);
				setLocating(false);
			},
			() => {
				setError('Could not read your location');
				setLocating(false);
			},
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	};

	const beginManualPlacement = () => {
		if (googleMatch) {
			const next: [number, number] = [
				googleMatch.latitude,
				googleMatch.longitude,
			];
			setCenter(next);
			setPin(next);
		}
		setPhase('manual');
	};

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		const placeId =
			phase === 'verify' ? (googleMatch?.googlePlaceId ?? null) : null;
		try {
			if (props.mode === 'draft') {
				await props.onSaved(pin[0], pin[1], placeId);
			} else if (props.mode === 'address') {
				await patchAddressCoordinates(props.id, pin[0], pin[1]);
				await props.onSaved();
			} else {
				await patchTaskDestinationCoordinates(props.id, pin[0], pin[1]);
				await props.onSaved();
			}
			onClose();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Could not save location');
		} finally {
			setSaving(false);
		}
	};

	const isVerify = phase === 'verify';
	const isManual = phase === 'manual' || phase === 'adjust';
	const lookupPending = phase === 'loading';

	const introText = (() => {
		if (lookupPending) {
			return 'Looking up this address…';
		}
		if (phase === 'verify') {
			return 'Found an address match. Compare the address below, then confirm or place the pin manually.';
		}
		if (phase === 'adjust') {
			return 'Move the map so the pin marks the exact delivery point.';
		}
		return 'Could not find an address match for this address. Place the pin manually on the map and save — crew use this GPS location for navigation and routes.';
	})();

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={onClose}
			title={title}
			size={isVerify ? 'lg' : '1000px'}
			centered
			pinFooter={isManual}
			zIndex={zIndex}
			closeOnClickOutside={!saving}
			classNames={{
				content: isVerify ? 'field-pin-modal-verify' : 'field-pin-modal',
				body: 'field-pin-modal-body',
			}}
		>
			{isVerify ? (
				<Stack gap='md'>
					<Text fz={12} c='dimmed'>
						{introText}
					</Text>
					{onFileContext.length > 0 ? (
						<AddressCompareColumn
							title='On file (unchanged)'
							lines={onFileContext}
						/>
					) : null}
					<SimpleGrid cols={{ base: 1, sm: 2 }} spacing='md'>
						<AddressValueBlock
							title='Address on file'
							value={streetLine.trim() || '—'}
						/>
						<AddressValueBlock title='Matched Address' value={googleStreet} />
					</SimpleGrid>
					<AddressMapPreview
						center={center}
						zoom={VERIFY_ZOOM}
						interactive
					/>
					{error ? (
						<Text fz={13} c='red'>
							{error}
						</Text>
					) : null}
					<Group justify='space-between' wrap='wrap' gap='xs'>
						<Button
							variant='default'
							size='sm'
							onClick={onClose}
							disabled={saving}
						>
							Cancel
						</Button>
						<Group gap='xs'>
							<Button
								variant='default'
								size='sm'
								leftSection={<MapPin size={16} />}
								onClick={beginManualPlacement}
								disabled={saving}
							>
								Place pin manually
							</Button>
							<Button
								color='brand'
								size='sm'
								leftSection={<Save size={16} />}
								onClick={() => void handleSave()}
								loading={saving}
							>
								Use this location
							</Button>
						</Group>
					</Group>
				</Stack>
			) : (
				<div className='field-pin-modal-layout'>
					<Stack gap={4} className='field-pin-modal-intro'>
						<Text fz={12} c='dimmed'>
							{introText}
						</Text>
					</Stack>
					<div className='field-pin-map-wrap'>
						{lookupPending ? (
							<Group justify='center' align='center' className='field-pin-map'>
								<Loader size='sm' />
							</Group>
						) : (
							<MapContainer
								center={center}
								zoom={MANUAL_ZOOM}
								className='field-pin-map'
								scrollWheelZoom
							>
								<TileLayer
									attribution='&copy; OpenStreetMap'
									url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
								/>
								<MapRecenter center={center} zoom={MANUAL_ZOOM} />
								<MapCenterTracker onChange={handlePinChange} />
								<MapInvalidateSize />
							</MapContainer>
						)}
						{!lookupPending ? (
							<div className='field-pin-center-pin' aria-hidden>
								<div className='field-pin-marker-dot' />
							</div>
						) : null}
					</div>
					<div className='field-pin-modal-footer'>
						<Text fz={12} c='dimmed'>
							{lookupPending
								? '—'
								: `${pin[0].toFixed(6)}, ${pin[1].toFixed(6)}`}
						</Text>
						{error ? (
							<Text fz={13} c='red'>
								{error}
							</Text>
						) : null}
						<Group justify='space-between' wrap='wrap' gap='xs'>
							<Button
								variant='default'
								size='sm'
								leftSection={<Navigation size={16} />}
								onClick={useMyLocation}
								loading={locating}
								disabled={saving || lookupPending}
							>
								Use my location
							</Button>
							<Group gap='xs'>
								<Button
									variant='default'
									size='sm'
									onClick={onClose}
									disabled={saving}
								>
									Cancel
								</Button>
								<Button
									color='brand'
									size='sm'
									leftSection={<Save size={16} />}
									onClick={() => void handleSave()}
									loading={saving}
									disabled={lookupPending}
								>
									Save location
								</Button>
							</Group>
						</Group>
					</div>
				</div>
			)}
		</KeyboardAwareModal>
	);
}
