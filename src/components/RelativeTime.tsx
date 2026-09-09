import { Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';
import {
	formatCompactTimeAgo,
	formatDateTime,
	formatShortDateTime,
	formatTimeAgo,
} from '../formatTime';

export type RelativeTimeVariant =
	| 'ago'
	| 'compactAgo'
	| 'absolute'
	| 'absoluteWithAgo'
	| 'shortWithAgo';

function withTooltip(label: string, children: ReactNode) {
	return (
		<Tooltip label={label} withArrow>
			<span className='relative-time'>{children}</span>
		</Tooltip>
	);
}

export function RelativeTime({
	value,
	variant = 'ago',
}: {
	value: string | null;
	variant?: RelativeTimeVariant;
}) {
	const absolute = formatDateTime(value);
	if (absolute === '—') return '—';

	const ago = formatTimeAgo(value);
	const compactAgo = formatCompactTimeAgo(value);

	if (variant === 'ago') {
		if (!ago) return absolute;
		return withTooltip(absolute, ago);
	}

	if (variant === 'compactAgo') {
		if (!compactAgo) return absolute;
		return withTooltip(absolute, compactAgo);
	}

	if (variant === 'absolute') {
		if (!ago) return absolute;
		return withTooltip(ago, absolute);
	}

	if (variant === 'shortWithAgo') {
		const short = formatShortDateTime(value);
		if (!compactAgo) {
			if (!ago) return short;
			return withTooltip(ago, short);
		}
		return (
			<>
				{withTooltip(compactAgo, short)}
				{' ('}
				{withTooltip(absolute, compactAgo)}
				{')'}
			</>
		);
	}

	if (!ago) return absolute;
	return (
		<>
			{withTooltip(ago, absolute)}
			{' ('}
			{withTooltip(absolute, ago)}
			{')'}
		</>
	);
}
