-- Field product branding: caramel accent replaces legacy purple default.
UPDATE org_settings
SET accent_color = '#b45309'
WHERE lower(accent_color) = '#732e75';
