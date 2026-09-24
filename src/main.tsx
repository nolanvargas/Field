import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { provideGlobalGridOptions } from 'ag-grid-community';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/tiptap/styles.css';
import 'sonner/dist/styles.css';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/compactNav.css';
import './styles/tasks.css';
import './styles/dev-testing-hub.css';
import { theme } from './theme';
import App from './App';
import { initAndroidBackButton } from './androidBack';
import { startNativeSafeAreaInsets } from './nativeSafeAreaInsets';
import './largeFont';

// CSS file themes (ag-theme-quartz) — keep legacy theming vs Theming API default.
provideGlobalGridOptions({ theme: 'legacy' });

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'field-color-scheme',
});

void initAndroidBackButton();
startNativeSafeAreaInsets();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      colorSchemeManager={colorSchemeManager}
    >
      <DatesProvider settings={{ firstDayOfWeek: 0 }}>
        <App />
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
