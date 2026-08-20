import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Center, Loader, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { divIcon } from 'leaflet';
import {
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	useMap,
	useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
	listCrewLocations,
	type CrewLocation,
} from '../api/crewLocations';
import { useCurrentUser } from '../context/CurrentUserContext';
import { clusterCrewLocations } from './crewClustering';

/** Downtown Las Vegas — hard-coded for MVP. */
const LAS_VEGAS_CENTER: [number, number] = [36.1699, -115.1398];
const DEFAULT_ZOOM = 11;

function initialsFromName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) {
		const token = parts[0];
		return token.slice(0, 2).toUpperCase();
	}
	const first = parts[0].charAt(0);
	const last = parts[parts.length - 1].charAt(0);
	return `${first}${last}`.toUpperCase();
}

function formatRecordedAt(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
}

/** Same task identity shown on task cards: type plus external key when present. */
function taskLabel(loc: CrewLocation): string {
	const key = loc.externalKey.trim();
	return key ? `${loc.taskType} - #${key}` : loc.taskType;
}

function crewMarkerIcon(initials: string) {
	return divIcon({
		className: 'field-crew-marker',
		html: `<div class="field-crew-marker-circle">${initials}</div>`,
		iconSize: [36, 36],
		iconAnchor: [18, 18],
		popupAnchor: [0, -18],
	});
}

/** +N bubble shown in place of crew markers that overlap at the current zoom. */
function crewGroupIcon(count: number) {
	return divIcon({
		className: 'field-crew-marker',
		html: `<div class="field-crew-marker-circle field-crew-marker-group">+${count}</div>`,
		iconSize: [42, 42],
		iconAnchor: [21, 21],
		popupAnchor: [0, -21],
	});
}

/** Content shown in a crew popover; group bubbles stack one of these per member. */
function CrewPopupContent({ loc }: { loc: CrewLocation }) {
	const jobTitle = loc.jobTitle.trim();
	const location = loc.destinationAddress.trim();
	return (
		<div className='field-crew-popup-entry'>
			<strong>{loc.displayName}</strong>
			<div>
				{loc.eventType === 'started' ? 'Started' : 'Ended'} ·{' '}
				{formatRecordedAt(loc.recordedAt)}
			</div>
			<div>{taskLabel(loc)}</div>
			{jobTitle ? <div>{jobTitle}</div> : null}
			{location ? <div>{location}</div> : null}
		</div>
	);
}

function CrewMapMarkers({ locations }: { locations: CrewLocation[] }) {
	const map = useMap();
	const [zoom, setZoom] = useState(map.getZoom());
	useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

	// Re-cluster whenever locations refresh or the user zooms, so bubbles stay
	// distinct when zoomed in and collapse into +N groups when zoomed out.
	const clusters = useMemo(
		() => clusterCrewLocations(locations, map, zoom),
		[locations, map, zoom],
	);

	const icons = useMemo(
		() =>
			Object.fromEntries(
				locations.map((loc) => [
					loc.userId,
					crewMarkerIcon(initialsFromName(loc.displayName)),
				]),
			),
		[locations],
	);

	return (
		<>
			{clusters.map((cluster) => {
				if (cluster.members.length === 1) {
					const loc = cluster.members[0];
					return (
						<Marker
							key={loc.userId}
							position={[loc.latitude, loc.longitude]}
							icon={icons[loc.userId]}
						>
							<Popup>
								<div className='field-crew-popup'>
									<CrewPopupContent loc={loc} />
								</div>
							</Popup>
						</Marker>
					);
				}

				const key = cluster.members
					.map((member) => member.userId)
					.sort()
					.join('|');
				return (
					<Marker
						key={key}
						position={[cluster.latitude, cluster.longitude]}
						icon={crewGroupIcon(cluster.members.length)}
					>
						<Popup>
							<div className='field-crew-popup field-crew-popup-group'>
								{cluster.members.map((loc) => (
									<CrewPopupContent key={loc.userId} loc={loc} />
								))}
							</div>
						</Popup>
					</Marker>
				);
			})}
		</>
	);
}

function CrewMapView({ locations }: { locations: CrewLocation[] }) {
	return (
		<MapContainer
			center={LAS_VEGAS_CENTER}
			zoom={DEFAULT_ZOOM}
			className='field-crew-map'
			scrollWheelZoom
		>
			{/* Carto Voyager — softer than OSM, more contrast than Positron */}
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
			/>
			<CrewMapMarkers locations={locations} />
		</MapContainer>
	);
}

/** Desktop-only admin map of last known crew GPS from task_crew_events. */
export function CrewMapPage() {
	// Read matchMedia on first paint — Mantine coerces unset to false via `matches || false`,
	// which falsely redirects before the effect runs when getInitialValueInEffect is true.
	const isDesktop = useMediaQuery('(min-width: 48em)', true, {
		getInitialValueInEffect: false,
	});
	const { user, loading: userLoading } = useCurrentUser();
	const [locations, setLocations] = useState<CrewLocation[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isDesktop || user?.role !== 'admin') return;

		const controller = new AbortController();
		setError(null);
		listCrewLocations(controller.signal)
			.then(setLocations)
			.catch((err: unknown) => {
				if (controller.signal.aborted) return;
				setError(err instanceof Error ? err.message : 'Failed to load');
				setLocations([]);
			});

		return () => controller.abort();
	}, [isDesktop, user?.role]);

	if (userLoading) {
		return (
			<Center py='xl'>
				<Loader size='sm' />
			</Center>
		);
	}

	if (!isDesktop || user?.role !== 'admin') {
		return <Navigate to='/' replace />;
	}

	if (error) {
		return (
			<Center py='xl'>
				<Text c='red'>{error}</Text>
			</Center>
		);
	}

	if (locations == null) {
		return (
			<Center py='xl'>
				<Loader size='sm' />
			</Center>
		);
	}

	return (
		<div className='field-crew-map-page'>
			<CrewMapView locations={locations} />
		</div>
	);
}
