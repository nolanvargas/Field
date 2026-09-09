import { Button, Text } from '@mantine/core';
import { ExternalLink, MapPin } from 'lucide-react';
import { hasDestinationCoords } from '../../shared/destinationCoords.js';
import {
	mapsPlatform,
	openMapsNavigationCoords,
} from '../openMapsNavigation';

export type TaskDestinationDisplayProps = {
	destinationAddressId: number | null;
	destinationAddressName: string;
	destinationAddress: string;
	destinationBuilding: string;
	destinationNotes: string;
	destinationLatitude: number | null;
	destinationLongitude: number | null;
	onGeoLocate: () => void;
	onAddressNameClick?: () => void;
	geoLocateDisabled?: boolean;
};

function Field({
	label,
	value,
	onClick,
}: {
	label: string;
	value: string;
	onClick?: () => void;
}) {
	const display = value || '—';
	return (
		<>
			<dt className='task-detail-field-key'>{label}</dt>
			<dd className='task-detail-field-value'>
				{onClick && value ? (
					<button
						type='button'
						className='task-detail-destination-map-link task-detail-destination-name-link'
						onClick={onClick}
					>
						<span className='task-detail-destination-map-link-text'>
							{display}
						</span>
					</button>
				) : (
					display
				)}
			</dd>
		</>
	);
}

export function TaskDestinationDisplay({
	destinationAddressId,
	destinationAddressName,
	destinationAddress,
	destinationBuilding,
	destinationNotes,
	destinationLatitude,
	destinationLongitude,
	onGeoLocate,
	onAddressNameClick,
	geoLocateDisabled = false,
}: TaskDestinationDisplayProps) {
	const hasDestination =
		destinationAddressId != null ||
		Boolean(destinationAddressName) ||
		Boolean(destinationAddress);
	const hasCoords = hasDestinationCoords({
		destinationLatitude,
		destinationLongitude,
	});
	const canGeoLocate =
		!hasCoords && Boolean(destinationAddress || destinationAddressName);
	const opensMapsTab = hasCoords && mapsPlatform() === 'web';

	if (!hasDestination) {
		return (
			<Text size='sm' c='dimmed'>
				None
			</Text>
		);
	}

	return (
		<dl className='task-detail-fields'>
			<Field
				label='Name'
				value={destinationAddressName}
				onClick={
					destinationAddressId != null && onAddressNameClick
						? onAddressNameClick
						: undefined
				}
			/>
			<dt className='task-detail-field-key'>Street</dt>
			<dd className='task-detail-field-value'>
				<div className='task-detail-destination-address'>
					{hasCoords &&
					destinationAddress &&
					destinationLatitude != null &&
					destinationLongitude != null ? (
						<button
							type='button'
							className='task-detail-destination-map-link'
							title={
								opensMapsTab ? 'Open in Maps (new tab)' : 'Open in Maps'
							}
							onClick={() =>
								openMapsNavigationCoords({
									latitude: destinationLatitude,
									longitude: destinationLongitude,
								})
							}
						>
							<span className='task-detail-destination-map-link-text'>
								{destinationAddress}
							</span>
							{opensMapsTab ? (
								<ExternalLink
									size={13}
									strokeWidth={2.25}
									className='task-detail-destination-map-link-icon'
									aria-hidden
								/>
							) : null}
						</button>
					) : (
						<span>{destinationAddress || '—'}</span>
					)}
					{canGeoLocate ? (
						<Button
							size='compact-xs'
							variant='light'
							leftSection={<MapPin size={14} />}
							onClick={onGeoLocate}
							disabled={geoLocateDisabled}
						>
							Geo-locate
						</Button>
					) : null}
				</div>
			</dd>
			<Field label='Building' value={destinationBuilding} />
			<Field label='Notes' value={destinationNotes} />
		</dl>
	);
}
