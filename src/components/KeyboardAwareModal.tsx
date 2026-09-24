import { Modal, type ModalProps, type ModalStylesNames } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { CSSProperties } from 'react';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';

type ModalStyleMap = Partial<Record<ModalStylesNames, CSSProperties>>;

function mergeModalStyles(
	base: ModalProps['styles'],
	extra: ModalStyleMap | undefined,
): ModalProps['styles'] {
	if (!extra) return base;

	if (typeof base === 'function') {
		return (theme, props, u) => {
			const resolved = (base(theme, props, u) ?? {}) as ModalStyleMap;
			return {
				...resolved,
				...extra,
				inner: { ...resolved.inner, ...extra.inner },
				content: { ...resolved.content, ...extra.content },
				body: { ...resolved.body, ...extra.body },
				header: { ...resolved.header, ...extra.header },
			};
		};
	}

	const resolved = (base ?? {}) as ModalStyleMap;
	return {
		...resolved,
		...extra,
		inner: { ...resolved.inner, ...extra.inner },
		content: { ...resolved.content, ...extra.content },
		body: { ...resolved.body, ...extra.body },
		header: { ...resolved.header, ...extra.header },
	};
}

/** Desktop / non-fullscreen: keep modal clear of shell chrome via CSS vars. */
const TOP_INSET =
	'max(5dvh, calc(var(--field-shell-header, 0px) + var(--field-modal-gap, 8px)), env(safe-area-inset-top, 0px))';

const BOTTOM_INSET =
	'max(5dvh, calc(var(--field-shell-footer, 0px) + var(--field-modal-gap, 8px)))';

function concatClassNames(
	base: ModalProps['classNames'],
	extra: Partial<Record<ModalStylesNames, string>>,
): ModalProps['classNames'] {
	if (!extra || Object.keys(extra).length === 0) return base;
	const resolved =
		base && typeof base === 'object' && !Array.isArray(base)
			? { ...base }
			: {};
	for (const [key, value] of Object.entries(extra)) {
		const slot = key as ModalStylesNames;
		const prev = resolved[slot];
		resolved[slot] = prev ? `${prev} ${value}` : value;
	}
	return resolved;
}

type KeyboardAwareModalProps = ModalProps & {
	/**
	 * Keep a footer pinned: content does not scroll; put overflow on a
	 * child scroll region instead (see task detail modal).
	 */
	pinFooter?: boolean;
	/** Edge-to-edge on narrow viewports (default). Set false for compact dialogs. */
	mobileFullScreen?: boolean;
};

/**
 * Mobile: full-screen modal filling the (keyboard-resized) WebView.
 * Desktop: centered dialog inset below header / above footer.
 */
export function KeyboardAwareModal({
	centered = true,
	styles,
	classNames,
	opened,
	onClose,
	pinFooter = false,
	mobileFullScreen = true,
	fullScreen: fullScreenProp,
	zIndex = 300,
	...props
}: KeyboardAwareModalProps) {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ, true, {
		getInitialValueInEffect: false,
	});
	const fullScreen =
		fullScreenProp ?? Boolean(mobileFullScreen && isMobile);

	const headerSafeTop =
		'calc(var(--mantine-spacing-md) + env(safe-area-inset-top, 0px))';

	useAndroidBackHandler(() => onClose?.(), Boolean(opened && onClose));

	const pinFooterContent = pinFooter
		? {
				display: 'flex',
				flexDirection: 'column' as const,
				overflow: 'hidden',
			}
		: { overflowY: 'auto' as const };

	const layoutStyles: ModalStyleMap = fullScreen
		? {
				inner: {
					paddingTop: 0,
					paddingBottom: 0,
					paddingInline: 0,
				},
				content: {
					...pinFooterContent,
					maxHeight: '100%',
					height: '100%',
				},
				header: {
					paddingTop: headerSafeTop,
					...(pinFooter ? { flexShrink: 0 } : {}),
				},
			}
		: {
				inner: {
					paddingTop: TOP_INSET,
					paddingBottom: BOTTOM_INSET,
				},
				content: {
					maxHeight: `calc(100dvh - (${TOP_INSET}) - (${BOTTOM_INSET}))`,
					...pinFooterContent,
				},
			};

	if (pinFooter) {
		if (!fullScreen) {
			layoutStyles.header = {
				flexShrink: 0,
			};
		}
		layoutStyles.body = {
			flex: 1,
			minHeight: 0,
			display: 'flex',
			flexDirection: 'column',
			overflow: 'hidden',
			paddingBottom: 0,
		};
	}

	const mergedClassNames = fullScreen
		? concatClassNames(classNames, {
				content: 'field-mobile-fullscreen-modal',
			})
		: classNames;

	return (
		<Modal
			{...props}
			opened={opened}
			onClose={onClose}
			fullScreen={fullScreen}
			centered={fullScreen ? false : centered}
			transitionProps={
				fullScreen
					? { transition: 'fade', duration: 200, ...props.transitionProps }
					: props.transitionProps
			}
			zIndex={zIndex}
			classNames={mergedClassNames}
			styles={mergeModalStyles(styles, layoutStyles)}
		/>
	);
}
