import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { theme } from '../../src/theme';

function UiProviders({ children }: { children: ReactNode }) {
	return (
		<MantineProvider theme={theme} defaultColorScheme='light' forceColorScheme='light'>
			<DatesProvider settings={{ firstDayOfWeek: 0 }}>{children}</DatesProvider>
		</MantineProvider>
	);
}

export function renderUi(
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>,
) {
	return render(ui, {
		wrapper: UiProviders,
		...options,
	});
}
