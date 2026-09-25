import { useEffect, useState } from 'react';
import {
	getFieldConnectivity,
	startFieldConnectivity,
	subscribeFieldConnectivity,
	type FieldConnectivitySnapshot,
} from '../connectivity/fieldConnectivity';

export function useFieldConnectivity(): FieldConnectivitySnapshot {
	const [state, setState] = useState(getFieldConnectivity);

	useEffect(() => {
		startFieldConnectivity();
		return subscribeFieldConnectivity(setState);
	}, []);

	return state;
}
