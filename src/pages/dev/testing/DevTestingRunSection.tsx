import { useCallback, useEffect, useState } from 'react';

import { Alert, Box, Button, Group, Stack, Text } from '@mantine/core';

import { Play, Square } from 'lucide-react';

import { listNpmScripts } from '../../../api/devScripts';
import { NpmScriptRunOutput } from '../../../components/dev/NpmScriptRunOutput';
import { useNpmScriptRun } from '../../../hooks/useNpmScriptRun';
import { TEST_NPM_SCRIPTS } from './testingHubSections';

export function DevTestingRunSection() {
	const [descriptions, setDescriptions] = useState<Record<string, string>>({});
	const [loadError, setLoadError] = useState<string | null>(null);
	const {
		running,
		runId,
		output,
		exitCode,
		runError,
		outputRef,
		startRun,
		stopRun,
	} = useNpmScriptRun();

	useEffect(() => {
		const controller = new AbortController();
		void listNpmScripts(controller.signal)
			.then((payload) => {
				if (!controller.signal.aborted) {
					setDescriptions(payload.descriptions);
				}
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setLoadError(
					err instanceof Error ? err.message : 'Failed to load script names',
				);
			});
		return () => controller.abort();
	}, []);

	const runScript = useCallback(
		(name: string) => {
			void startRun({ name });
		},
		[startRun],
	);

	return (
		<Stack gap='md'>
			<Alert variant='light' title='Prerequisites'>
				Unit and RTL: no extra setup. Integration and E2E need{' '}
				<code>docker compose up -d</code>, <code>npm run db:schema</code>, and
				for E2E locally{' '}
				<code>npm run db:seed-dev-data</code> or <code>npm run db:reset</code>.
				Playwright starts API + Vite via <code>scripts/e2e-serve.mjs</code>.
			</Alert>

			{loadError ? (
				<Alert color='red' title='Error'>
					{loadError}
				</Alert>
			) : null}
			{runError ? (
				<Alert color='red' title='Run failed'>
					{runError}
				</Alert>
			) : null}

			<Group gap='xs' align='flex-start'>
				{TEST_NPM_SCRIPTS.map((name) => (
					<Button
						key={name}
						variant='light'
						leftSection={<Play size={14} />}
						onClick={() => runScript(name)}
						loading={running}
						disabled={running}
					>
						{name}
					</Button>
				))}
				{running && runId ? (
					<Button
						variant='light'
						color='red'
						leftSection={<Square size={14} />}
						onClick={() => void stopRun()}
					>
						Stop
					</Button>
				) : null}
			</Group>

			<Stack gap={4}>
				{TEST_NPM_SCRIPTS.map((name) =>
					descriptions[name] ? (
						<Text key={name} size='xs' c='dimmed'>
							<code>{name}</code> — {descriptions[name]}
						</Text>
					) : null,
				)}
			</Stack>

			<Box>
				<NpmScriptRunOutput
					output={output}
					running={running}
					exitCode={exitCode}
					outputRef={outputRef}
				/>
			</Box>
		</Stack>
	);
}
