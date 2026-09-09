import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader, Center } from '@mantine/core';
import { AuthRoot } from './auth/AuthRoot';
import { MobileAuthGate } from './auth/MobileAuthGate';
import { FieldAppShell } from './components/AppShell';
import { ToastHost } from './components/ToastHost';
import { AlertProvider } from './context/AlertContext';
import { CurrentUserProvider, useCurrentUser } from './context/CurrentUserContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import { OrgSettingsProvider } from './context/OrgSettingsContext';
import { DocumentTitle } from './documentTitle';
import { NotificationTapListener } from './notifications/NotificationTapListener';
import { AddressesPage } from './pages/AddressesPage';
import { ContactsPage } from './pages/ContactsPage';
import { CrewMapPage } from './pages/CrewMapPage';
import { MorePage } from './pages/MorePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { TasksPage } from './pages/TasksPage';
import { CompleteTaskPage } from './pages/CompleteTaskPage';
import { DeliverTaskPage } from './pages/DeliverTaskPage';
import { TaskViewPage } from './pages/TaskViewPage';
import { UsersPage } from './pages/UsersPage';
import { ManagementPage } from './pages/ManagementPage';
import { TrackingPage } from './pages/TrackingPage';
import { TrackingPreviewPage } from './pages/TrackingPreviewPage';
import { LightColorSchemeScope } from './components/LightColorSchemeScope';
import { StatusTransitionsPrototypePage } from './pages/StatusTransitionsPrototypePage';
import { DevScriptsPage } from './pages/DevScriptsPage';
import { DevTestsPage } from './pages/DevTestsPage';
import { DevDocumentTemplatesPage } from './pages/DevDocumentTemplatesPage';
import { DevelopmentPage } from './pages/DevelopmentPage';
import { hasPermission, PERMISSIONS } from '../shared/permissions.js';

function HomeRedirect() {
	const { loading, mobileSession, user } = useCurrentUser();

	if (loading) {
		return (
			<Center py='xl'>
				<Loader size='sm' />
			</Center>
		);
	}

	if (mobileSession) {
		return <Navigate to='/my-tasks' replace />;
	}
	if (hasPermission(user?.permissions, PERMISSIONS.viewAllTasks)) {
		return <Navigate to='/tasks' replace />;
	}
	return <Navigate to='/my-tasks' replace />;
}

function AllTasksPage() {
	const { loading, user } = useCurrentUser();

	if (loading) {
		return (
			<Center py='xl'>
				<Loader size='sm' />
			</Center>
		);
	}

	if (!hasPermission(user?.permissions, PERMISSIONS.viewAllTasks)) {
		return <Navigate to='/my-tasks' replace />;
	}

	return <TasksPage key='all' mode='all' />;
}

function AuthenticatedApp() {
	return (
		<AuthRoot>
			<CurrentUserProvider>
				<OrgSettingsProvider>
					<NavigationGuardProvider>
					<DocumentTitle />
					<MobileAuthGate>
						<NotificationTapListener />
						<Routes>
							<Route element={<FieldAppShell />}>
								<Route path='/' element={<HomeRedirect />} />
								<Route path='/tasks' element={<AllTasksPage />} />
								<Route
									path='/my-tasks'
									element={<TasksPage key='mine' mode='mine' />}
								/>
								<Route
									path='/task/:taskId/complete'
									element={<CompleteTaskPage />}
								/>
								<Route
									path='/task/:taskId/deliver'
									element={<DeliverTaskPage />}
								/>
								<Route path='/task/:taskId' element={<TaskViewPage />} />
								<Route path='/contacts' element={<ContactsPage />} />
								<Route path='/addresses' element={<AddressesPage />} />
								<Route path='/users' element={<UsersPage />} />
								<Route path='/management' element={<ManagementPage />} />
								{import.meta.env.DEV ? (
									<Route path='/development' element={<DevelopmentPage />}>
										<Route path='tests' element={<DevTestsPage />} />
										<Route path='scripts' element={<DevScriptsPage />} />
										<Route
											path='status-transitions'
											element={<StatusTransitionsPrototypePage />}
										/>
										<Route
											path='document-templates'
											element={<DevDocumentTemplatesPage />}
										/>
									</Route>
								) : null}
								{import.meta.env.DEV ? (
									<>
										<Route
											path='/dev/status-transitions'
											element={
												<Navigate to='/development/status-transitions' replace />
											}
										/>
										<Route
											path='/dev/tests'
											element={<Navigate to='/development/tests' replace />}
										/>
										<Route
											path='/dev/scripts'
											element={<Navigate to='/development/scripts' replace />}
										/>
									</>
								) : null}
								<Route path='/crew-map' element={<CrewMapPage />} />
								<Route path='/more' element={<MorePage />} />
								<Route path='/settings' element={<MorePage />} />
								<Route
									path='/notifications'
									element={<NotificationsPage />}
								/>
								<Route path='*' element={<Navigate to='/' replace />} />
							</Route>
						</Routes>
					</MobileAuthGate>
					</NavigationGuardProvider>
				</OrgSettingsProvider>
			</CurrentUserProvider>
		</AuthRoot>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<ToastHost />
			<AlertProvider>
				<Routes>
					<Route
						path='/t/:token'
						element={
							<LightColorSchemeScope>
								<TrackingPage />
							</LightColorSchemeScope>
						}
					/>
					<Route
						path='/tracking-page-preview'
						element={
							<LightColorSchemeScope>
								<TrackingPreviewPage />
							</LightColorSchemeScope>
						}
					/>
					<Route path='/*' element={<AuthenticatedApp />} />
				</Routes>
			</AlertProvider>
		</BrowserRouter>
	);
}
