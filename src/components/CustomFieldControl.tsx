import { useEffect, useMemo, useState } from 'react';
import {
	MultiSelect,
	NumberInput,
	Select,
	SimpleGrid,
	Switch,
	TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { OrgCustomFieldDef } from '../api/orgSettings';
import type { CustomFieldValue } from '../types/task';
import { listUsers } from '../api/users';
import { listContacts } from '../api/contacts';
import { listAddresses } from '../api/addresses';
import { listTasks } from '../api/tasks';
import {
	isCustomFieldUndefined,
	labeledCustomFieldDefs,
	type CustomFieldValues,
} from '../customFields';
import { useOrgSettings } from '../context/OrgSettingsContext';
import type { CustomFieldEntity } from '../../shared/customFieldEntities.js';

export type LookupOption = { value: string; label: string };

export type CustomFieldLookupCatalogs = {
	users: LookupOption[];
	contacts: LookupOption[];
	addresses: LookupOption[];
	tasks: LookupOption[];
};

export type CustomFieldLookupLoading = Record<
	keyof CustomFieldLookupCatalogs,
	boolean
>;

export const EMPTY_LOOKUP_CATALOGS: CustomFieldLookupCatalogs = {
	users: [],
	contacts: [],
	addresses: [],
	tasks: [],
};

const NO_LOOKUP_LOADING: CustomFieldLookupLoading = {
	users: false,
	contacts: false,
	addresses: false,
	tasks: false,
};

const inputSize = 'sm' as const;

const switchAlignStyles = {
	root: {
		display: 'flex',
		alignItems: 'center',
		minHeight: 36,
	},
};

function toDateOnlyValue(value: string | Date | null): string {
	if (!value) return '';
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return '';
		const y = value.getFullYear();
		const m = String(value.getMonth() + 1).padStart(2, '0');
		const d = String(value.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return String(value).slice(0, 10);
}

function lookupKey(
	table: string | null,
): keyof CustomFieldLookupCatalogs | null {
	if (
		table === 'users' ||
		table === 'contacts' ||
		table === 'addresses' ||
		table === 'tasks'
	) {
		return table;
	}
	return null;
}

export function CustomFieldControl({
	def,
	value,
	onChange,
	disabled,
	catalogs,
	loading = NO_LOOKUP_LOADING,
}: {
	def: OrgCustomFieldDef;
	value: CustomFieldValue | undefined;
	onChange: (value: CustomFieldValue) => void;
	disabled: boolean;
	catalogs: CustomFieldLookupCatalogs;
	loading?: CustomFieldLookupLoading;
}) {
	const required = def.required;
	const key = lookupKey(def.lookupTable);
	const lookupOptions = key ? catalogs[key] : [];
	const lookupLoading = key ? loading[key] : false;
	// A bulk import left this required field blank; the sentinel is not a value.
	const effectiveValue = isCustomFieldUndefined(value) ? null : value;

	if (def.dataType === 'number') {
		return (
			<NumberInput
				size={inputSize}
				label={def.label}
				required={required}
				min={0}
				value={
					typeof effectiveValue === 'number' ||
					typeof effectiveValue === 'string'
						? effectiveValue
						: ''
				}
				onChange={(v) => onChange(v === '' ? null : v)}
				disabled={disabled}
			/>
		);
	}
	if (def.dataType === 'boolean') {
		return (
			<Switch
				label={def.label}
				checked={effectiveValue === true}
				onChange={(e) => onChange(e.currentTarget.checked)}
				disabled={disabled}
				styles={switchAlignStyles}
			/>
		);
	}
	if (def.dataType === 'date') {
		const dateValue =
			typeof effectiveValue === 'string' &&
			/^\d{4}-\d{2}-\d{2}/.test(effectiveValue)
				? effectiveValue.slice(0, 10)
				: null;
		return (
			<DatePickerInput
				size={inputSize}
				label={def.label}
				required={required}
				placeholder='Pick date'
				valueFormat='MMM D, YYYY'
				value={dateValue}
				onChange={(v) => onChange(toDateOnlyValue(v) || null)}
				clearable={!required}
				disabled={disabled}
			/>
		);
	}
	if (def.dataType === 'lookup') {
		return (
			<Select
				size={inputSize}
				label={def.label}
				required={required}
				data={lookupOptions}
				value={
					effectiveValue == null || effectiveValue === ''
						? null
						: String(effectiveValue)
				}
				onChange={(v) => onChange(v)}
				searchable
				clearable={!required}
				placeholder={lookupLoading ? 'Loading…' : 'Select'}
				nothingFoundMessage={lookupLoading ? 'Loading…' : 'Nothing found'}
				disabled={disabled}
				comboboxProps={{ shadow: 'xl' }}
				maxDropdownHeight={400}
			/>
		);
	}
	if (def.dataType === 'select') {
		const options = (def.options ?? []).map((option) => ({
			value: option,
			label: option,
		}));
		return (
			<Select
				size={inputSize}
				label={def.label}
				required={required}
				data={options}
				value={
					effectiveValue == null || effectiveValue === ''
						? null
						: String(effectiveValue)
				}
				onChange={(v) => onChange(v)}
				clearable={!required}
				placeholder='Select'
				disabled={disabled}
				comboboxProps={{ shadow: 'xl' }}
			/>
		);
	}
	if (def.dataType === 'multiselect') {
		const options = def.options ?? [];
		const selected = Array.isArray(effectiveValue)
			? effectiveValue.map(String)
			: typeof effectiveValue === 'string' && effectiveValue
				? [effectiveValue]
				: [];
		return (
			<MultiSelect
				size={inputSize}
				label={def.label}
				required={required}
				data={options}
				value={selected}
				onChange={(v) => onChange(v.length > 0 ? v : null)}
				clearable={!required}
				placeholder='Select'
				disabled={disabled}
				comboboxProps={{ shadow: 'xl' }}
			/>
		);
	}
	return (
		<TextInput
			size={inputSize}
			label={def.label}
			required={required}
			value={effectiveValue == null ? '' : String(effectiveValue)}
			onChange={(e) => onChange(e.currentTarget.value)}
			disabled={disabled}
		/>
	);
}

/** Live org defs for one entity, labeled and slot-sorted. */
export function useEntityCustomFieldDefs(
	entity: CustomFieldEntity,
): OrgCustomFieldDef[] {
	const { settings } = useOrgSettings();
	const defs = settings.customFieldDefs[entity];
	return useMemo(() => labeledCustomFieldDefs(defs ?? []), [defs]);
}

/** The custom field block shared by task and master-data forms. */
export function CustomFieldStack({
	defs,
	values,
	onChange,
	disabled,
	catalogs,
	loading,
}: {
	defs: OrgCustomFieldDef[];
	values: CustomFieldValues;
	onChange: (slot: number, value: CustomFieldValue) => void;
	disabled: boolean;
	catalogs: CustomFieldLookupCatalogs;
	loading?: CustomFieldLookupLoading;
}) {
	if (defs.length === 0) return null;
	return (
		<SimpleGrid cols={defs.length === 1 ? 1 : 2} spacing={6}>
			{defs.map((def) => (
				<CustomFieldControl
					key={def.slot}
					def={def}
					value={values[String(def.slot)]}
					onChange={(v) => onChange(def.slot, v)}
					disabled={disabled}
					catalogs={catalogs}
					loading={loading}
				/>
			))}
		</SimpleGrid>
	);
}

/**
 * Loads only the catalogs the given defs actually reference. Task forms already
 * hold these lists for other controls and pass their own catalogs instead.
 */
export function useCustomFieldLookups(
	defs: OrgCustomFieldDef[],
	enabled: boolean,
): { catalogs: CustomFieldLookupCatalogs; loading: CustomFieldLookupLoading } {
	const [catalogs, setCatalogs] = useState<CustomFieldLookupCatalogs>(
		EMPTY_LOOKUP_CATALOGS,
	);
	const [loading, setLoading] =
		useState<CustomFieldLookupLoading>(NO_LOOKUP_LOADING);

	const needed = useMemo(() => {
		const tables = new Set<keyof CustomFieldLookupCatalogs>();
		for (const def of labeledCustomFieldDefs(defs)) {
			if (def.dataType !== 'lookup') continue;
			const key = lookupKey(def.lookupTable);
			if (key) tables.add(key);
		}
		return [...tables].sort().join(',');
	}, [defs]);

	useEffect(() => {
		if (!enabled || !needed) return;
		const tables = needed.split(',') as (keyof CustomFieldLookupCatalogs)[];
		const controller = new AbortController();
		setLoading((prev) => {
			const next = { ...prev };
			for (const table of tables) next[table] = true;
			return next;
		});

		const finish = (
			table: keyof CustomFieldLookupCatalogs,
			options: LookupOption[],
		) => {
			if (controller.signal.aborted) return;
			setCatalogs((prev) => ({ ...prev, [table]: options }));
			setLoading((prev) => ({ ...prev, [table]: false }));
		};

		const fail = (table: keyof CustomFieldLookupCatalogs, err: unknown) => {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			console.error(err);
			finish(table, []);
		};

		for (const table of tables) {
			if (table === 'users') {
				listUsers(controller.signal)
					.then((users) =>
						finish(
							'users',
							users.map((u) => ({ value: u.id, label: u.displayName })),
						),
					)
					.catch((err: unknown) => fail('users', err));
			} else if (table === 'contacts') {
				listContacts(controller.signal)
					.then((contacts) =>
						finish(
							'contacts',
							contacts.map((c) => ({
								value: String(c.id),
								label: c.name.trim(),
							})),
						),
					)
					.catch((err: unknown) => fail('contacts', err));
			} else if (table === 'addresses') {
				listAddresses(controller.signal)
					.then((addresses) =>
						finish(
							'addresses',
							addresses.map((a) => ({
								value: String(a.id),
								label: a.addressName || a.streetLine,
							})),
						),
					)
					.catch((err: unknown) => fail('addresses', err));
			} else if (table === 'tasks') {
				listTasks(controller.signal)
					.then((tasks) =>
						finish(
							'tasks',
							tasks
								.filter((t) => t.externalKey.trim().length > 0)
								.map((t) => ({
									value: String(t.id),
									label: t.externalKey.trim(),
								})),
						),
					)
					.catch((err: unknown) => fail('tasks', err));
			}
		}

		return () => controller.abort();
	}, [enabled, needed]);

	return { catalogs, loading };
}
