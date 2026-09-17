import { beforeEach, describe, expect, it, vi } from 'vitest';

const capacitorMocks = vi.hoisted(() => ({
	getPlatform: vi.fn(() => 'web'),
}));

vi.mock('@capacitor/core', () => ({
	Capacitor: {
		getPlatform: capacitorMocks.getPlatform,
	},
}));

describe('openMapsNavigation', () => {
	const assignMock = vi.fn();

	beforeEach(() => {
		capacitorMocks.getPlatform.mockReturnValue('web');
		assignMock.mockReset();
		Object.defineProperty(window, 'location', {
			value: { assign: assignMock, href: 'http://localhost/' },
			writable: true,
			configurable: true,
		});
	});

	it('opens Google Maps in a new tab on web', async () => {
		const { openMapsNavigationCoords } = await import('../src/openMapsNavigation');
		const open = vi.spyOn(window, 'open').mockReturnValue(null);

		openMapsNavigationCoords({ latitude: 36.1699, longitude: -115.1398 });

		expect(open).toHaveBeenCalledWith(
			'https://www.google.com/maps/dir/?api=1&destination=36.1699%2C-115.1398',
			'_blank',
			'noopener,noreferrer',
		);
		open.mockRestore();
	});

	it('uses Apple Maps URL scheme on iOS', async () => {
		capacitorMocks.getPlatform.mockReturnValue('ios');
		const { openMapsNavigationCoords } = await import('../src/openMapsNavigation');

		openMapsNavigationCoords({ latitude: 36.1, longitude: -115.1 });

		expect(assignMock).toHaveBeenCalledWith('maps://?daddr=36.1%2C-115.1');
	});

	it('uses geo: intent on Android', async () => {
		capacitorMocks.getPlatform.mockReturnValue('android');
		const { openMapsNavigationCoords } = await import('../src/openMapsNavigation');

		openMapsNavigationCoords({ latitude: 36.1, longitude: -115.1 });

		expect(assignMock).toHaveBeenCalledWith('geo:0,0?q=36.1%2C-115.1');
	});

	it('ignores invalid coordinates', async () => {
		const { openMapsNavigationCoords } = await import('../src/openMapsNavigation');
		const open = vi.spyOn(window, 'open').mockReturnValue(null);

		openMapsNavigationCoords({ latitude: Number.NaN, longitude: 1 });

		expect(open).not.toHaveBeenCalled();
		expect(assignMock).not.toHaveBeenCalled();
		open.mockRestore();
	});

	it('mapsPlatform reflects Capacitor platform', async () => {
		const { mapsPlatform } = await import('../src/openMapsNavigation');
		capacitorMocks.getPlatform.mockReturnValue('ios');
		expect(mapsPlatform()).toBe('ios');
		capacitorMocks.getPlatform.mockReturnValue('web');
		expect(mapsPlatform()).toBe('web');
	});
});
