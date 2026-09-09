import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Group, Loader, Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Plus } from 'lucide-react';
import type { RowClickedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { listAddresses, type Address } from '../api/addresses';
import {
	AddressCatalogModals,
	type AddressCatalogModalsHandle,
} from '../components/AddressCatalogModals';
import { PageHeader } from '../components/PageHeader';
import {
	AG_GRID_MOBILE_MQ,
	addressColumnDefs,
	entityCustomFieldColumnDefs,
	getDefaultColDef,
	usePersistedAgGridSession,
} from '../agGridDefaults';
import { useEntityCustomFieldDefs } from '../components/CustomFieldControl';
import { notifyError } from '../notify';

export function AddressesPage() {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const catalogModalsRef = useRef<AddressCatalogModalsHandle>(null);
	const [addresses, setAddresses] = useState<Address[]>([]);
	const [loading, setLoading] = useState(true);

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);
	const gridSession = usePersistedAgGridSession('addresses', !isMobile);
	const customFieldDefs = useEntityCustomFieldDefs('address');
	const columnDefs = useMemo(
		() => [
			...addressColumnDefs,
			...entityCustomFieldColumnDefs<Address>(customFieldDefs),
		],
		[customFieldDefs],
	);

	const refreshAddresses = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		try {
			const next = await listAddresses(signal);
			if (!signal?.aborted) setAddresses(next);
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			notifyError(
				err instanceof Error ? err.message : 'Failed to load addresses',
			);
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refreshAddresses(controller.signal);
		return () => controller.abort();
	}, [refreshAddresses]);

	const handleRowClicked = (event: RowClickedEvent<Address>) => {
		if (event.data?.id != null) {
			catalogModalsRef.current?.openDetail(event.data.id);
		}
	};

	return (
		<Box className='tasks-page'>
			<PageHeader
				title='Addresses'
				right={
					<Button
						leftSection={<Plus size={18} />}
						onClick={() => catalogModalsRef.current?.openCreate()}
						color='brand'
					>
						New Address
					</Button>
				}
			/>

			<Box className='tasks-grid-wrap ag-theme-quartz'>
				{loading && addresses.length === 0 ? (
					<Group justify='center' py='xl'>
						<Loader size='sm' />
					</Group>
				) : (
					<AgGridProvider modules={[AllCommunityModule]}>
						<AgGridReact<Address>
							rowData={addresses}
							columnDefs={columnDefs}
							defaultColDef={defaultColDef}
							getRowId={(p) => String(p.data.id)}
							rowHeight={isMobile ? 40 : undefined}
							animateRows
							suppressCellFocus
							suppressHorizontalScroll
							rowStyle={{ cursor: 'pointer' }}
							onRowClicked={handleRowClicked}
							onGridReady={gridSession.onGridReady}
							onGridSizeChanged={gridSession.onGridSizeChanged}
							onFirstDataRendered={gridSession.onFirstDataRendered}
							onSortChanged={gridSession.onSortChanged}
							onFilterChanged={gridSession.onFilterChanged}
						/>
					</AgGridProvider>
				)}
			</Box>

			<AddressCatalogModals
				ref={catalogModalsRef}
				allowDelete
				onMutated={refreshAddresses}
			/>
		</Box>
	);
}
