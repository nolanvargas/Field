# Hosted Google Sheet import templates

Optional browser-based editing for bulk import. Field still imports **CSV only**; Google Sheets is a zero-install editor for blank templates and samples.

## User workflow

1. In **Management → Import / export**, click **Open workbook (Template + Sample tabs)** (shown when sheet URLs are configured).
2. Click **Make a copy** in Google Sheets.
3. Edit on the **Template** tab (headers only) or **Sample** tab (example rows).
4. **File → Download → Comma Separated Values (.csv)**.
5. Upload the CSV in Field and use preview / apply as usual.

**Export current** is CSV-only from Field. Users may upload that CSV into their own Google Sheet copy if they want to edit existing data in the browser.

## Maintainer: create master workbooks

Run once (or whenever columns/sample data change):

```bash
npm run import:sheet-spec
```

This writes UTF-8 CSV files under `import-sheet-spec/` (gitignored):

| File | Google Sheet tab |
|------|------------------|
| `contacts-template.csv` | Template |
| `contacts-sample.csv` | Sample |
| `addresses-template.csv` | Template |
| `addresses-sample.csv` | Sample |
| `users-template.csv` | Template |
| `users-sample.csv` | Sample |

For each entity, create one Google workbook (e.g. "Field — Contacts import"):

1. Create a new Google Sheet.
2. Rename the first tab **Template**. **File → Import** → upload `{entity}-template.csv` (replace current sheet).
3. Add a tab **Sample**. Import `{entity}-sample.csv` into that tab.
4. **Share** → General access → **Anyone with the link** → **Viewer**.
5. Copy the spreadsheet ID from the URL (`…/d/{SPREADSHEET_ID}/edit`) and add it to env (see below). Field builds the copy link as `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/copy`.

Repeat for contacts, addresses, and users (three workbooks total).

## Environment variable

Add to `.env` (Vite reads this at build/dev time):

```env
VITE_IMPORT_GOOGLE_SHEETS={"contacts":"SPREADSHEET_ID","addresses":"SPREADSHEET_ID","users":"SPREADSHEET_ID"}
```

- Each value is the spreadsheet ID only (from the sheet URL), not the full link.
- Field expands IDs to `https://docs.google.com/spreadsheets/d/{id}/copy` for the UI.
- Omit the variable or use `{}` to hide Google Sheets links in the UI.
- You can configure only some entities; missing keys hide the link for that entity.

Restart `npm run dev` after changing `.env`.

## Keeping sheets in sync with code

When you change [`shared/importColumns.js`](../shared/importColumns.js) or [`shared/importSampleData.js`](../shared/importSampleData.js), or edit custom field labels in **Management → Custom fields**:

1. Run `npm run import:sheet-spec` (needs the database running — custom field columns come from org settings).
2. Re-import the generated CSVs into each master workbook tab (replace data).
3. No env change needed unless spreadsheet IDs change.

## Column notes for sheet authors

- Header row text must match Field exactly (see Import / export column reference in the app).
- Blank **Template** and **Sample** tabs do not include an `Id` column. Use **Export current** in Field when you need ids for updating existing records.
- **Users** permission columns: `TRUE` / `FALSE` (also accepts `T`/`F`, `Y`/`N`, any case). Empty = `FALSE`.
- Sample rows use fictional `@example.com` addresses.

## Custom field columns

Custom fields configured for users, contacts, or addresses appear as extra columns after the builtin ones, labelled exactly as configured. Renaming a field changes the header, so regenerate the workbook after any label change. If a custom field label matches a builtin header, the builtin column wins.

Cell formats mirror the app: `TRUE`/`FALSE` for checkboxes, `YYYY-MM-DD` for dates, comma-separated values for multi-select, and the record id for lookups. **Export current** emits ids (not names) so an exported file re-imports unchanged.

A **required** custom field never blocks an import. A blank cell is stored as a system placeholder, shown as a dimmed `undefined` in the app, and exported as a blank cell. The record must be given a real value before it can be saved from a form again.
