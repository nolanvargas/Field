import { Box, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export function DetailField({
	label,
	value,
	span = 1,
}: {
	label: string;
	value: ReactNode;
	span?: number;
}) {
	return (
		<Box style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
			<Text fz={11} c='dimmed' fw={600} tt='uppercase' mb={2}>
				{label}
			</Text>
			<Text fz={14} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
				{typeof value === 'string' || value == null ? value || '—' : value}
			</Text>
		</Box>
	);
}
