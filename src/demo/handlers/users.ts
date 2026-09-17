import { getDemoStore } from '../store';
import { jsonResponse } from '../response';

export function handleGetUsers(searchParams: URLSearchParams): Response {
	const { users } = getDemoStore();
	const role = searchParams.get('role')?.trim();
	const list = role
		? users.filter((u) => u.role.toLowerCase() === role.toLowerCase())
		: users;
	return jsonResponse({ users: list });
}
