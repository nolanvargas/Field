import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import {
	getOrgSettings,
	type OrgSettings,
} from '../api/orgSettings';
import { applyOrgAccent } from '../applyOrgAccent';
import { DEFAULT_ACCENT } from '../../shared/orgAccent.js';
import { syncPrintTemplateCache } from '../printTemplateCache';
import { notifyError } from '../notify';

interface OrgSettingsContextValue {
	settings: OrgSettings | null;
	loading: boolean;
	refresh: () => Promise<void>;
}

const DEFAULT_SETTINGS: OrgSettings = {
	externalKeyLabel: 'Job',
	cancelRetentionDays: 7,
	requiredTaskFields: [],
	webAuthSource: 'env',
	webAuthConfig: { clientId: '', tenantId: '' },
	taskTypes: [],
	customFieldDefs: { task: [], user: [], contact: [], address: [] },
	printTemplatesRevision: '',
	accentColor: DEFAULT_ACCENT,
};

const OrgSettingsContext = createContext<OrgSettingsContextValue | null>(null);

export function OrgSettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState<OrgSettings | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		try {
			const next = await getOrgSettings(signal);
			if (!signal?.aborted) {
				setSettings(next);
				applyOrgAccent(next.accentColor);
				void syncPrintTemplateCache(next.printTemplatesRevision, signal).catch(
					() => {
						// Menu falls back to live API fetch in task detail.
					},
				);
			}
		} catch (err: unknown) {
			if (
				(err instanceof DOMException || err instanceof Error) &&
				err.name === 'AbortError'
			) {
				return;
			}
			if (!signal?.aborted) {
				notifyError(
					err instanceof Error ? err.message : 'Failed to load settings',
				);
			}
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refresh(controller.signal);
		return () => controller.abort();
	}, [refresh]);

	const value = useMemo(
		() => ({
			settings,
			loading,
			refresh: async () => refresh(),
		}),
		[settings, loading, refresh],
	);

	return (
		<OrgSettingsContext.Provider value={value}>
			{children}
		</OrgSettingsContext.Provider>
	);
}

export function useOrgSettings(): OrgSettingsContextValue & {
	settings: OrgSettings;
} {
	const ctx = useContext(OrgSettingsContext);
	if (!ctx) {
		throw new Error('useOrgSettings must be used within OrgSettingsProvider');
	}
	return {
		...ctx,
		settings: ctx.settings ?? DEFAULT_SETTINGS,
	};
}

