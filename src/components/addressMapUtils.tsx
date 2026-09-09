import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export function MapRecenter({
	center,
	zoom,
}: {
	center: [number, number];
	zoom: number;
}) {
	const map = useMap();
	useEffect(() => {
		map.setView(center, zoom);
	}, [center, zoom, map]);
	return null;
}

export function MapInvalidateSize() {
	const map = useMap();
	useEffect(() => {
		const container = map.getContainer();
		const parent = container.parentElement;
		if (!parent) return;
		const sync = () => map.invalidateSize({ animate: false });
		const observer = new ResizeObserver(sync);
		observer.observe(parent);
		sync();
		return () => observer.disconnect();
	}, [map]);
	return null;
}
