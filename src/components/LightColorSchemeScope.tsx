import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
	type ReactNode,
} from 'react';

import { MantineProvider } from '@mantine/core';

import { theme } from '../theme';

import '../styles/light-color-scheme-scope.css';

const SCOPE_CLASS = 'light-color-scheme-scope';
const PORTAL_CLASS = 'light-color-scheme-scope__portal';

const LightScopePortalContext = createContext<HTMLElement | null>(null);

export interface LightColorSchemeScopeProps {
	className?: string;
	children: ReactNode;
}

/** Mantine subtree that always renders in light mode, independent of app color scheme. */
export function LightColorSchemeScope({ className, children }: LightColorSchemeScopeProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	const setPortalRef = useCallback((node: HTMLDivElement | null) => {
		setPortalTarget(node);
	}, []);
	const rootClassName = className ? `${SCOPE_CLASS} ${className}` : SCOPE_CLASS;

	return (
		<div
			ref={rootRef}
			className={rootClassName}
			data-mantine-color-scheme='light'
		>
			<MantineProvider
				theme={theme}
				forceColorScheme='light'
				cssVariablesSelector={`.${SCOPE_CLASS}`}
				getRootElement={() => rootRef.current ?? undefined}
				withGlobalClasses={false}
			>
				<LightScopePortalContext.Provider value={portalTarget}>
					{children}
					<div ref={setPortalRef} className={PORTAL_CLASS} />
				</LightScopePortalContext.Provider>
			</MantineProvider>
		</div>
	);
}

/** Portal mount inside a LightColorSchemeScope — keeps Select/Menu overlays in light mode. */
export function useLightColorSchemePortalTarget(): HTMLElement | null {
	return useContext(LightScopePortalContext);
}

/** Spread onto Mantine Select comboboxProps. */
export function useLightScopeComboboxProps() {
	const target = useLightColorSchemePortalTarget();
	if (!target) return {};
	return { portalProps: { target } };
}

/** Spread onto Mantine Menu portalProps. */
export function useLightScopeMenuPortalProps() {
	const target = useLightColorSchemePortalTarget();
	if (!target) return {};
	return { target };
}
