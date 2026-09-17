import { useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, Minimize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { MapInvalidateSize, MapRecenter } from './addressMapUtils';

const previewMarkerIcon = L.divIcon({
	className: 'field-pin-preview-marker',
	html: '<div class="field-pin-marker-dot"></div>',
	iconSize: [18, 18],
	iconAnchor: [9, 18],
});

export type AddressMapPreviewProps = {
	center: [number, number];
	zoom?: number;
	className?: string;
	interactive?: boolean;
	expandable?: boolean;
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
};

export function AddressMapPreview({
	center,
	zoom = 16,
	className = 'field-pin-preview-map-wrap',
	interactive = false,
	expandable = false,
	expanded,
	onExpandedChange,
}: AddressMapPreviewProps) {
	const [internalExpanded, setInternalExpanded] = useState(false);
	const isExpanded = expanded ?? internalExpanded;
	const setExpanded = onExpandedChange ?? setInternalExpanded;
	const wrapClassName = [
		className,
		isExpanded ? 'field-pin-preview-map-wrap--expanded' : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div className={wrapClassName}>
			<MapContainer
				center={center}
				zoom={zoom}
				className='field-pin-map'
				scrollWheelZoom={interactive}
				dragging={interactive}
				doubleClickZoom={interactive}
				touchZoom={interactive}
			>
				<TileLayer
					attribution='&copy; OpenStreetMap'
					url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
				/>
				<MapRecenter center={center} zoom={zoom} />
				<Marker position={center} icon={previewMarkerIcon} />
				<MapInvalidateSize />
			</MapContainer>
			{expandable ? (
				<button
					type='button'
					className='field-pin-preview-map-expand'
					onClick={() => setExpanded(!isExpanded)}
					aria-label={isExpanded ? 'Shrink map' : 'Expand map'}
					aria-pressed={isExpanded}
				>
					{isExpanded ? (
						<Minimize2 size={16} strokeWidth={2.25} aria-hidden />
					) : (
						<Maximize2 size={16} strokeWidth={2.25} aria-hidden />
					)}
				</button>
			) : null}
		</div>
	);
}
