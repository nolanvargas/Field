import type { RefObject } from 'react';

import { Box, Group, Text } from '@mantine/core';

type NpmScriptRunOutputProps = {
	output: string;
	running: boolean;
	exitCode: number | null;
	outputRef: RefObject<HTMLPreElement | null>;
	title?: string;
};

export function NpmScriptRunOutput({
	output,
	running,
	exitCode,
	outputRef,
	title = 'Output',
}: NpmScriptRunOutputProps) {
	if (!output && !running && exitCode == null) {
		return null;
	}

	return (
		<Box>
			<Group justify='space-between' mb='xs'>
				<Text fw={600}>{title}</Text>
				{exitCode != null ? (
					<Text size='sm' c={exitCode === 0 ? 'teal' : 'red'}>
						Exit {exitCode}
					</Text>
				) : running ? (
					<Text size='sm' c='dimmed'>Running…</Text>
				) : null}
			</Group>
			<pre ref={outputRef} className='dev-scripts-output'>
				{output || (running ? '' : '(no output)')}
			</pre>
		</Box>
	);
}
