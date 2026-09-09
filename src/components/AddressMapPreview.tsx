import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
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
};

export function AddressMapPreview({
	center,
	zoom = 16,
	className = 'field-pin-preview-map-wrap',
	interactive = false,
}: AddressMapPreviewProps) {
	return (
		<div className={className}>
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
		</div>
	);
}
