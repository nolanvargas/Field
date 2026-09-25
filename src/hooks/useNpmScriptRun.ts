import { useCallback, useEffect, useRef, useState } from 'react';

import {
	npmScriptRunStreamUrl,
	runNpmScript,
	stopNpmScriptRun,
} from '../api/devScripts';

export function useNpmScriptRun() {
	const [running, setRunning] = useState(false);
	const [runId, setRunId] = useState<string | null>(null);
	const [output, setOutput] = useState('');
	const [exitCode, setExitCode] = useState<number | null>(null);
	const [runError, setRunError] = useState<string | null>(null);
	const outputRef = useRef<HTMLPreElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	const closeEventSource = useCallback(() => {
		eventSourceRef.current?.close();
		eventSourceRef.current = null;
	}, []);

	useEffect(() => () => closeEventSource(), [closeEventSource]);

	useEffect(() => {
		if (!runId) return;

		closeEventSource();
		const es = new EventSource(npmScriptRunStreamUrl(runId));
		eventSourceRef.current = es;

		es.addEventListener('output', (event) => {
			try {
				const payload = JSON.parse(event.data) as { text?: string };
				if (payload.text) {
					setOutput((prev) => prev + payload.text);
				}
			} catch {
				// ignore malformed chunks
			}
		});

		es.addEventListener('exit', (event) => {
			try {
				const payload = JSON.parse(event.data) as { code?: number | null };
				setExitCode(payload.code ?? null);
			} catch {
				setExitCode(null);
			}
			setRunning(false);
			es.close();
			eventSourceRef.current = null;
		});

		es.onerror = () => {
			setRunning(false);
			es.close();
			eventSourceRef.current = null;
		};

		return () => {
			es.close();
		};
	}, [runId, closeEventSource]);

	useEffect(() => {
		const el = outputRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [output]);

	const clearOutput = useCallback(() => {
		setOutput('');
		setExitCode(null);
	}, []);

	const startRun = useCallback(
		async (options: { name?: string; command?: string }) => {
			const name = options.name?.trim() ?? '';
			const command = options.command?.trim() ?? '';
			if (!name && !command) return;

			setRunning(true);
			clearOutput();
			setRunError(null);
			closeEventSource();

			try {
				const result = await runNpmScript(
					command ? { command } : { name },
				);
				setRunId(result.runId);
			} catch (err: unknown) {
				setRunning(false);
				setRunError(
					err instanceof Error ? err.message : 'Failed to run script',
				);
			}
		},
		[clearOutput, closeEventSource],
	);

	const stopRun = useCallback(async () => {
		if (!runId) return;
		try {
			await stopNpmScriptRun(runId);
		} catch (err: unknown) {
			setRunError(
				err instanceof Error ? err.message : 'Failed to stop script',
			);
		}
	}, [runId]);

	return {
		running,
		runId,
		output,
		exitCode,
		runError,
		setRunError,
		outputRef,
		startRun,
		stopRun,
		clearOutput,
	};
}
