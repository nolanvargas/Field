import { type ComponentProps, type MouseEvent } from 'react';
import {
	NavLink as RouterNavLink,
	useLocation,
	useNavigate,
} from 'react-router-dom';
import { useNavigationGuard } from '../context/NavigationGuardContext';

export function isNavActive(pathname: string, to: string, end: boolean) {
	return end
		? pathname === to
		: pathname === to || pathname.startsWith(`${to}/`);
}

type FieldRouterNavLinkProps = ComponentProps<typeof RouterNavLink>;

export function FieldRouterNavLink({
	to,
	end = false,
	onClick,
	...rest
}: FieldRouterNavLinkProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const { confirmLeave } = useNavigationGuard();
	const destination = typeof to === 'string' ? to : (to.pathname ?? '');

	return (
		<RouterNavLink
			to={to}
			end={end}
			onClick={(event: MouseEvent<HTMLAnchorElement>) => {
				onClick?.(event);
				if (event.defaultPrevented) return;
				if (isNavActive(location.pathname, destination, end)) return;
				event.preventDefault();
				void (async () => {
					if (await confirmLeave()) navigate(to);
				})();
			}}
			{...rest}
		/>
	);
}
