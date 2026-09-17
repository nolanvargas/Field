export function jsonResponse(body: unknown, status = 200): Response {
	const text = JSON.stringify(body);
	return new Response(text, {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}

export function errorResponse(message: string, status = 501): Response {
	return jsonResponse({ error: message }, status);
}
