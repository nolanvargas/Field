import {
	useEffect,
	useId,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
} from 'react';
import {
	Stack,
	Group,
	TextInput,
	Textarea,
	Select,
	MultiSelect,
	Autocomplete,
	Button,
	Text,
	SimpleGrid,
	UnstyledButton,
	Input,
	Switch,
	ActionIcon,
	type ComboboxItem,
	type ComboboxLikeRenderOptionInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
	StickyNote,
	MapPin,
	Building2,
	Calendar,
	Users,
	UserRound,
	Save,
	X,
	Plus,
	Paperclip,
	Trash2,
	CornerDownLeft,
} from 'lucide-react';
import { useOrgSettings } from '../context/OrgSettingsContext';
import {
	labeledCustomFieldDefs,
	requiredCustomFieldError,
	visibleLabeledCustomFieldDefs,
} from '../customFields';
import { isCustomFieldVisible } from '../../shared/customFieldShowWhen.js';
import {
	REQUIRED_TASK_FIELDS,
	isTaskFieldRequired,
	requiredTaskFieldError,
} from '../../shared/requiredTaskFields.js';
import type { OrgCustomFieldDef } from '../api/orgSettings';
import type { CustomFieldValue } from '../types/task';
import { resolveOrgTaskIcon } from '../orgIcons';
import {
	attachmentAcceptAttr,
	validateAttachmentFile,
} from '../api/attachments';
import { createContact, listContacts } from '../api/contacts';
import { createAddress, listAddresses } from '../api/addresses';
import {
	AddressPlaceInput,
	type ResolvedPlace,
} from './AddressPlaceInput';
import { listUsers } from '../api/users';
import { listTasks } from '../api/tasks';
import { formatShortName } from '../formatName';
import {
	CustomFieldStack,
	type LookupOption as CustomFieldLookupOption,
} from './CustomFieldControl';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { NewContactModal, type NewContactFormValues } from './NewContactModal';
import { NewAddressModal, type NewAddressFormValues } from './NewAddressModal';
import { TaskAttachments } from './TaskAttachments';
import { TaskDescEditor } from './TaskDescEditor';
import { notifyError } from '../notify';

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputSize = 'sm' as const;

const switchAlignStyles = {
	root: {
		display: 'flex',
		alignItems: 'center',
		minHeight: 36,
	},
};

function TaskFormSection({
	title,
	action,
	children,
	required = false,
}: {
	title?: string;
	action?: ReactNode;
	children: ReactNode;
	required?: boolean;
}) {
	return (
		<section className='task-form-section'>
			{title ? (
				<div className='task-form-section-header'>
					<h3 className='task-form-section-title'>
						{title}
						{required ? (
							<span className='task-form-required-mark' aria-hidden>
								{' '}
								*
							</span>
						) : null}
					</h3>
					{action}
				</div>
			) : null}
			{children}
		</section>
	);
}

/** Clear (X) control for TextInput / Textarea — Mantine only wires clearable on select-like inputs. */
function textClearSection(
	hasValue: boolean,
	onClear: () => void,
	disabled?: boolean,
) {
	if (!hasValue || disabled) return undefined;
	return (
		<Input.ClearButton
			onClick={(e) => {
				e.stopPropagation();
				onClear();
			}}
		/>
	);
}

/** One-shot grow-to-content (keeps CSS resize usable — unlike Mantine autosize). */
function fitTextareaToContent(el: HTMLTextAreaElement | null) {
	if (!el) return;
	el.style.height = 'auto';
	el.style.height = `${el.scrollHeight}px`;
}

/** Dropdown only after the user types — click/focus on an empty field stays closed. */
function useTypeToOpenDropdown() {
	const [opened, setOpened] = useState(false);
	const [search, setSearch] = useState('');
	const suppressOpenRef = useRef(false);

	const clear = () => {
		suppressOpenRef.current = false;
		setSearch('');
		setOpened(false);
	};

	return {
		openOnFocus: false as const,
		search,
		dropdownOpened: opened,
		onDropdownClose: () => setOpened(false),
		onSearchChange: (value: string) => {
			setSearch(value);
			if (suppressOpenRef.current) {
				suppressOpenRef.current = false;
				return;
			}
			setOpened(value.trim().length > 0);
		},
		/** Call when Select value changes so label sync does not reopen the menu. */
		suppressNextSearchOpen: () => {
			suppressOpenRef.current = true;
			setOpened(false);
		},
		clearSearch: clear,
		reset: clear,
	};
}

type ComboboxOptionLike = string | { value: string; label: string };

/**
 * Value of the only option matching the search, or null when zero or many
 * match. Mirrors Mantine's default filter (case-insensitive substring).
 */
function singleSearchMatch(
	options: readonly ComboboxOptionLike[],
	search: string,
): string | null {
	const query = search.trim().toLowerCase();
	if (query.length === 0) return null;
	let match: string | null = null;
	for (const option of options) {
		const value = typeof option === 'string' ? option : option.value;
		const label = typeof option === 'string' ? option : option.label;
		if (!label.toLowerCase().includes(query)) continue;
		if (match !== null) return null;
		match = value;
	}
	return match;
}

/** True while the user has arrow-keyed to an option — Mantine's Enter owns it. */
function hasHighlightedOption(input: HTMLInputElement): boolean {
	const listId = input.getAttribute('aria-controls');
	if (!listId) return false;
	return (
		document
			.getElementById(listId)
			?.querySelector('[data-combobox-selected]') != null
	);
}

/**
 * Enter picks `match` — the only option left after filtering — so the user can
 * keep typing the next entry.
 */
function singleMatchEnter(
	match: string | null,
	onSelect: (value: string) => void,
) {
	return (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
		if (match == null) return;
		if (hasHighlightedOption(event.currentTarget)) return;
		event.preventDefault();
		onSelect(match);
	};
}

/** Marks the option Enter would pick with a dimmed Enter key glyph. */
function renderOptionWithEnterHint(match: string | null) {
	return ({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>) => (
		<>
			<span>{option.label}</span>
			{option.value === match ? (
				<CornerDownLeft
					size={14}
					className='task-form-enter-hint'
					aria-hidden
				/>
			) : null}
		</>
	);
}

function defaultDateTimeLocal(hours: number, minutes = 0): string {
	const d = new Date();
	d.setHours(hours, minutes, 0, 0);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Form stores datetime-local (`YYYY-MM-DDTHH:mm`); DateTimePicker uses `YYYY-MM-DD HH:mm:ss`. */
function toDateTimePickerValue(local: string): string | null {
	const trimmed = local.trim();
	if (!trimmed) return null;
	const withSpace = trimmed.includes('T') ? trimmed.replace('T', ' ') : trimmed;
	if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(withSpace)) {
		return `${withSpace}:00`;
	}
	return withSpace;
}

function fromDateTimePickerValue(value: string | null): string {
	if (!value) return '';
	return value.replace(' ', 'T').slice(0, 16);
}

const dateTimePickerTimeProps = {
	withDropdown: true,
	popoverProps: { withinPortal: false },
	format: '12h' as const,
};

export interface NewTaskFormValues {
	contactIds: number[];
	pocContactId: number | null;
	/** Subset of contactIds that should receive automated task emails. */
	receiveEmailContactIds: number[];
	taskTypeId: number | null;
	taskType: string;
	externalKey: string;
	jobTitle: string;
	taskDesc: string;
	destinationAddressId: number | null;
	destinationAddressName: string;
	destinationAddress: string;
	destinationBuilding: string;
	destinationNotes: string;
	destinationLatitude: number | null;
	destinationLongitude: number | null;
	afterDateTime: string;
	beforeDateTime: string;
	crewMemberIds: string[];
	/** First crew member in crewMemberIds is always the lead. */
	leadCrewMemberId: string | null;
	customFields: Record<string, CustomFieldValue>;
}

/** First contact in the list is always the POC. */
function resolvePocContactId(contactIds: number[]): number | null {
	return contactIds[0] ?? null;
}

/** First crew member in the list is always the lead; the rest are sub. */
function resolveLeadCrewMemberId(crewMemberIds: string[]): string | null {
	return crewMemberIds[0] ?? null;
}

/** POC defaults to receiving email; others default off. */
function defaultReceiveEmailOnAdd(
	contactIds: number[],
	newContactId: number,
	prevReceiveEmailIds: number[],
): number[] {
	const isPoc = contactIds[0] === newContactId;
	if (isPoc) {
		return prevReceiveEmailIds.includes(newContactId)
			? prevReceiveEmailIds
			: [...prevReceiveEmailIds, newContactId];
	}
	return prevReceiveEmailIds;
}

function createEmptyForm(): NewTaskFormValues {
	return {
		contactIds: [],
		pocContactId: null,
		receiveEmailContactIds: [],
		taskTypeId: null,
		taskType: 'Delivery',
		externalKey: '',
		jobTitle: '',
		taskDesc: '',
		destinationAddressId: null,
		destinationAddressName: '',
		destinationAddress: '',
		destinationBuilding: '',
		destinationNotes: '',
		destinationLatitude: null,
		destinationLongitude: null,
		afterDateTime: defaultDateTimeLocal(7),
		beforeDateTime: defaultDateTimeLocal(15),
		crewMemberIds: [],
		leadCrewMemberId: null,
		customFields: {},
	};
}

type LookupOption = CustomFieldLookupOption;

interface NewTaskModalProps {
	opened: boolean;
	onClose: () => void;
	/** When set, modal is in edit mode and form is seeded from these values. */
	initialValues?: NewTaskFormValues | null;
	/** Frozen custom field defs for edit mode (from task snapshot). */
	fieldDefs?: OrgCustomFieldDef[] | null;
	/** Contact pills for edit mode before listContacts returns. */
	initialContactOptions?: { value: string; label: string }[] | null;
	/** Existing task id — enables live attachment upload/list while editing. */
	taskId?: number | null;
	onSave?: (
		values: NewTaskFormValues,
		addAnother: boolean,
		pendingFiles: File[],
	) => void | Promise<void>;
}

export function NewTaskModal({
	opened,
	onClose,
	initialValues = null,
	fieldDefs = null,
	initialContactOptions = null,
	taskId = null,
	onSave,
}: NewTaskModalProps) {
	const isEdit = initialValues != null;
	const { settings: orgSettings } = useOrgSettings();
	const enabledTaskTypes = orgSettings.taskTypes.filter((t) => t.enabled);
	const taskTypeOptions = (() => {
		const opts = enabledTaskTypes.map((t) => ({
			value: String(t.id),
			label: t.name,
			icon: t.icon,
			name: t.name,
		}));
		if (initialValues?.taskTypeId != null) {
			const id = String(initialValues.taskTypeId);
			if (!opts.some((o) => o.value === id)) {
				opts.unshift({
					value: id,
					label: initialValues.taskType,
					icon: 'CircleHelp',
					name: initialValues.taskType,
				});
			}
		}
		return opts;
	})();
	const attachmentInputId = useId();
	const attachmentInputRef = useRef<HTMLInputElement>(null);
	const destinationNotesRef = useRef<HTMLTextAreaElement>(null);
	const [form, setForm] = useState<NewTaskFormValues>(createEmptyForm);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [saving, setSaving] = useState(false);
	const [crewOptions, setCrewOptions] = useState<
		{ value: string; label: string }[]
	>([]);
	const [crewLoading, setCrewLoading] = useState(false);
	const [contactOptions, setContactOptions] = useState<
		{ value: string; label: string }[]
	>([]);
	const [contactLoading, setContactLoading] = useState(false);
	const [addressOptions, setAddressOptions] = useState<
		{
			value: string;
			label: string;
			streetLine: string;
			building: string;
			notes: string;
			latitude: number | null;
			longitude: number | null;
		}[]
	>([]);
	const [addressLoading, setAddressLoading] = useState(false);
	const [taskOptions, setTaskOptions] = useState<LookupOption[]>([]);
	const [taskLookupLoading, setTaskLookupLoading] = useState(false);
	const [newContactOpen, setNewContactOpen] = useState(false);
	const [newAddressOpen, setNewAddressOpen] = useState(false);
	const [addressSeed, setAddressSeed] = useState<NewAddressFormValues | null>(
		null,
	);
	const contactDropdown = useTypeToOpenDropdown();
	const addressDropdown = useTypeToOpenDropdown();
	const crewDropdown = useTypeToOpenDropdown();
	/** New tasks start by picking the type; edit mode opens straight on the form. */
	const [step, setStep] = useState<'pickType' | 'form'>('pickType');

	const update = <K extends keyof NewTaskFormValues>(
		key: K,
		value: NewTaskFormValues[K],
	) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const updateCustomField = (slot: number, value: CustomFieldValue) => {
		setForm((prev) => ({
			...prev,
			customFields: { ...prev.customFields, [String(slot)]: value },
		}));
	};

	const effectiveFieldDefs =
		fieldDefs && fieldDefs.length > 0
			? fieldDefs
			: orgSettings.customFieldDefs.task;
	const customFieldDefs = visibleLabeledCustomFieldDefs(
		effectiveFieldDefs,
		form.taskType,
	);
	const fieldRequired = (key: string) =>
		isTaskFieldRequired(orgSettings.requiredTaskFields, key);
	const needsTaskLookup = labeledCustomFieldDefs(effectiveFieldDefs).some(
		(d) => d.dataType === 'lookup' && d.lookupTable === 'tasks',
	);

	const addContact = (value: string | null) => {
		if (value == null) return;
		const id = Number(value);
		if (!Number.isInteger(id) || id < 1) return;
		contactDropdown.clearSearch();
		setForm((prev) => {
			if (prev.contactIds.includes(id)) return prev;
			const contactIds = [...prev.contactIds, id];
			return {
				...prev,
				contactIds,
				pocContactId: resolvePocContactId(contactIds),
				receiveEmailContactIds: defaultReceiveEmailOnAdd(
					contactIds,
					id,
					prev.receiveEmailContactIds,
				),
			};
		});
	};

	const setCrewMemberIds = (crewMemberIds: string[]) => {
		setForm((prev) => ({
			...prev,
			crewMemberIds,
			leadCrewMemberId: resolveLeadCrewMemberId(crewMemberIds),
		}));
	};

	const setTaskType = (taskTypeId: string) => {
		const match = enabledTaskTypes.find((t) => String(t.id) === taskTypeId);
		const nextType = match?.name ?? '';
		setForm((prev) => {
			const customFields = { ...prev.customFields };
			for (const def of labeledCustomFieldDefs(effectiveFieldDefs)) {
				if (!isCustomFieldVisible(def, nextType)) {
					delete customFields[String(def.slot)];
				}
			}
			return {
				...prev,
				taskTypeId: match?.id ?? null,
				taskType: nextType || prev.taskType,
				customFields,
			};
		});
	};

	/** New-task flow: picking the type is the first step of the modal. */
	const pickType = (taskTypeId: string) => {
		setTaskType(taskTypeId);
		setStep('form');
	};

	const reset = () => {
		setForm(initialValues ? { ...initialValues, customFields: { ...(initialValues.customFields ?? {}) } } : createEmptyForm());
		setPendingFiles([]);
		setNewContactOpen(false);
		setNewAddressOpen(false);
		setAddressSeed(null);
		contactDropdown.reset();
		addressDropdown.reset();
		crewDropdown.reset();
		setStep(isEdit ? 'form' : 'pickType');
		if (attachmentInputRef.current) attachmentInputRef.current.value = '';
	};

	const addPendingFiles = (fileList: FileList | null) => {
		const files = fileList ? Array.from(fileList) : [];
		if (files.length === 0) return;

		const accepted: File[] = [];
		for (const file of files) {
			const validationError = validateAttachmentFile(file);
			if (validationError) {
				notifyError(validationError);
				continue;
			}
			accepted.push(file);
		}
		if (accepted.length > 0) {
			setPendingFiles((prev) => [...prev, ...accepted]);
		}
		if (attachmentInputRef.current) attachmentInputRef.current.value = '';
	};

	const handleClose = () => {
		if (saving) return;
		reset();
		onClose();
	};

	const openNewAddress = () => {
		const seed: NewAddressFormValues = {
			addressName: form.destinationAddressName,
			streetLine: form.destinationAddress,
			building: form.destinationBuilding,
			notes: form.destinationNotes,
			latitude: form.destinationLatitude,
			longitude: form.destinationLongitude,
			googlePlaceId: null,
			customFields: {},
		};
		const hasAny = [
			seed.addressName,
			seed.streetLine,
			seed.building,
			seed.notes,
		].some((v) => v.trim().length > 0);
		setAddressSeed(hasAny ? seed : null);
		setNewAddressOpen(true);
	};

	const handleCreateContact = async (values: NewContactFormValues) => {
		const contact = await createContact({
			name: values.name.trim(),
			title: values.title.trim() || undefined,
			phone: values.phone.trim() || undefined,
			email: values.email.trim() || undefined,
			customFields: values.customFields,
		});
		const name = contact.name.trim();
		const title = contact.title.trim();
		const label = title
			? `${name} (${title})`
			: contact.email
				? `${name} (${contact.email})`
				: name;
		setContactOptions((prev) => {
			if (prev.some((o) => o.value === String(contact.id))) return prev;
			return [...prev, { value: String(contact.id), label }];
		});
		setForm((prev) => {
			if (prev.contactIds.includes(contact.id)) return prev;
			const contactIds = [...prev.contactIds, contact.id];
			return {
				...prev,
				contactIds,
				pocContactId: resolvePocContactId(contactIds),
				receiveEmailContactIds: defaultReceiveEmailOnAdd(
					contactIds,
					contact.id,
					prev.receiveEmailContactIds,
				),
			};
		});
	};

	const handleCreateAddress = async (values: NewAddressFormValues) => {
		const address = await createAddress({
			addressName: values.addressName.trim() || undefined,
			streetLine: values.streetLine.trim(),
			building: values.building.trim() || undefined,
			notes: values.notes.trim() || undefined,
			latitude: values.latitude,
			longitude: values.longitude,
			googlePlaceId: values.googlePlaceId,
			customFields: values.customFields,
		});
		const label = address.addressName || address.streetLine;
		setAddressOptions((prev) => {
			if (prev.some((o) => o.value === String(address.id))) return prev;
			return [
				...prev,
				{
					value: String(address.id),
					label,
					streetLine: address.streetLine,
					building: address.building,
					notes: address.notes,
					latitude: address.latitude,
					longitude: address.longitude,
				},
			];
		});
		setForm((prev) => ({
			...prev,
			destinationAddressId: address.id,
			destinationAddressName: label,
			destinationAddress: address.streetLine,
			destinationBuilding: address.building,
			destinationNotes: address.notes,
			destinationLatitude: address.latitude,
			destinationLongitude: address.longitude,
		}));
	};

	const handleSave = async (addAnother: boolean) => {
		if (saving) return;
		const missing =
			requiredTaskFieldError(form, orgSettings.requiredTaskFields, {
				externalKeyLabel: orgSettings.externalKeyLabel,
			}) ??
			requiredCustomFieldError(
				form.customFields,
				effectiveFieldDefs,
				form.taskType,
			);
		if (missing) {
			notifyError(missing);
			return;
		}
		setSaving(true);
		try {
			await onSave?.(form, addAnother, pendingFiles);
			if (addAnother) {
				setForm(createEmptyForm());
				setPendingFiles([]);
				contactDropdown.reset();
				addressDropdown.reset();
				crewDropdown.reset();
				setStep('pickType');
				if (attachmentInputRef.current) attachmentInputRef.current.value = '';
			} else {
				reset();
				onClose();
			}
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Failed to save task');
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		if (!opened) return;
		setForm(initialValues ? { ...initialValues, customFields: { ...(initialValues.customFields ?? {}) } } : createEmptyForm());
		setPendingFiles([]);
		setNewContactOpen(false);
		setNewAddressOpen(false);
		setAddressSeed(null);
		// initialValues is the edit-mode flag here; the dep array covers it.
		setStep(initialValues != null ? 'form' : 'pickType');
		if (initialContactOptions?.length) {
			setContactOptions((prev) => {
				const byValue = new Map(prev.map((o) => [o.value, o] as const));
				for (const option of initialContactOptions) {
					byValue.set(option.value, option);
				}
				return Array.from(byValue.values());
			});
		}
		if (attachmentInputRef.current) attachmentInputRef.current.value = '';
	}, [opened, initialValues, initialContactOptions]);

	// Grow once when notes change (venue fill / edit hydrate). Do not use Mantine
	// autosize — it continuously locks height and breaks the resize handle.
	useEffect(() => {
		if (!opened) return;
		const id = requestAnimationFrame(() => {
			fitTextareaToContent(destinationNotesRef.current);
		});
		return () => cancelAnimationFrame(id);
	}, [opened, form.destinationNotes]);

	useEffect(() => {
		if (!opened) return;

		const controller = new AbortController();
		setCrewLoading(true);
		setContactLoading(true);
		setAddressLoading(true);

		listUsers(controller.signal)
			.then((users) => {
				setCrewOptions(
					users.map((u) => ({
						value: u.id,
						label: formatShortName(u.displayName),
					})),
				);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.error(err);
				setCrewOptions([]);
			})
			.finally(() => {
				if (!controller.signal.aborted) setCrewLoading(false);
			});

		listContacts(controller.signal)
			.then((contacts) => {
				setContactOptions(
					contacts.map((c) => {
						const name = c.name.trim();
						const title = c.title.trim();
						return {
							value: String(c.id),
							label: title
								? `${name} (${title})`
								: c.email
									? `${name} (${c.email})`
									: name,
						};
					}),
				);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.error(err);
				setContactOptions([]);
			})
			.finally(() => {
				if (!controller.signal.aborted) setContactLoading(false);
			});

		listAddresses(controller.signal)
			.then((addresses) => {
				setAddressOptions(
					addresses.map((a) => ({
						value: String(a.id),
						label: a.addressName || a.streetLine,
						streetLine: a.streetLine,
						building: a.building,
						notes: a.notes,
						latitude: a.latitude,
						longitude: a.longitude,
					})),
				);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.error(err);
				setAddressOptions([]);
			})
			.finally(() => {
				if (!controller.signal.aborted) setAddressLoading(false);
			});

		return () => controller.abort();
	}, [opened]);

	useEffect(() => {
		if (!opened || !needsTaskLookup) return;

		const controller = new AbortController();
		setTaskLookupLoading(true);
		listTasks(controller.signal)
			.then((tasks) => {
				const withKey = tasks.filter((t) => {
					if (taskId != null && t.id === taskId) return false;
					return t.externalKey.trim().length > 0;
				});
				const keyCounts = new Map<string, number>();
				for (const t of withKey) {
					const key = t.externalKey.trim().toLowerCase();
					keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
				}
				withKey.sort((a, b) =>
					a.externalKey.localeCompare(b.externalKey, undefined, {
						numeric: true,
					}),
				);
				setTaskOptions(
					withKey.map((t) => {
						const key = t.externalKey.trim();
						const duplicate =
							(keyCounts.get(key.toLowerCase()) ?? 0) > 1;
						const title = t.jobTitle.trim();
						let label = key;
						if (duplicate) {
							label = title ? `${key} — ${title}` : `${key} (#${t.id})`;
						}
						return { value: String(t.id), label };
					}),
				);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.error(err);
				setTaskOptions([]);
			})
			.finally(() => {
				if (!controller.signal.aborted) setTaskLookupLoading(false);
			});

		return () => controller.abort();
	}, [opened, needsTaskLookup, taskId]);

	const TaskTypeIcon = resolveOrgTaskIcon(
		enabledTaskTypes.find((t) => t.id === form.taskTypeId)?.icon,
	);
	const availableContactOptions = contactOptions.filter(
		(o) => !form.contactIds.includes(Number(o.value)),
	);
	const availableCrewOptions = crewOptions.filter(
		(o) => !form.crewMemberIds.includes(o.value),
	);
	const contactEnterMatch = singleSearchMatch(
		availableContactOptions,
		contactDropdown.search,
	);
	const crewEnterMatch = singleSearchMatch(
		availableCrewOptions,
		crewDropdown.search,
	);

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={handleClose}
			title={isEdit ? 'Edit Task' : 'New Task'}
			size='1200px'
			centered
			pinFooter
			closeOnClickOutside={false}
			closeOnEscape={!saving}
			classNames={{
				content: 'task-form-modal',
				body: 'task-form-modal-body',
			}}
			styles={{
				title: { fontWeight: 700, fontSize: 14 },
				body: { paddingTop: 4, fontSize: 14 },
				header: { minHeight: 0, paddingBottom: 4 },
			}}
		>
			{/* Form stays mounted (hidden) on the type-picker step so the modal
			    keeps the exact size of the standard form; picker overlays it. */}
			<div
				className='task-form-inner'
				data-hidden={(!isEdit && step === 'pickType') || undefined}
				inert={!isEdit && step === 'pickType'}
			>
				<div className='task-form-scroll'>
					<div className='task-form-layout'>
						<div className='task-form-col'>
							<TaskFormSection title='Details'>
								<SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
									<Select
										size={inputSize}
										data={taskTypeOptions}
										value={
											form.taskTypeId != null
												? String(form.taskTypeId)
												: taskTypeOptions[0]?.value
										}
										onChange={(v) =>
											setTaskType(
												v ?? taskTypeOptions[0]?.value ?? '',
											)
										}
										leftSection={<TaskTypeIcon size={16} />}
										renderOption={({ option }) => {
											const iconName = taskTypeOptions.find(
												(t) => t.value === option.value,
											)?.icon;
											const Icon = resolveOrgTaskIcon(iconName);
											return (
												<Group gap={8} wrap='nowrap'>
													<Icon size={16} />
													<span>{option.label}</span>
												</Group>
											);
										}}
										allowDeselect={false}
										disabled={saving}
									/>
									<TextInput
										size={inputSize}
										placeholder={orgSettings.externalKeyLabel}
										label={
											fieldRequired(REQUIRED_TASK_FIELDS.externalKey)
												? orgSettings.externalKeyLabel
												: undefined
										}
										required={fieldRequired(REQUIRED_TASK_FIELDS.externalKey)}
										value={form.externalKey}
										onChange={(e) =>
											update('externalKey', e.currentTarget.value)
										}
										maxLength={100}
										disabled={saving}
									/>
								</SimpleGrid>
								<TextInput
									size={inputSize}
									placeholder='Job Title'
									label={
										fieldRequired(REQUIRED_TASK_FIELDS.jobTitle)
											? 'Job Title'
											: undefined
									}
									required={fieldRequired(REQUIRED_TASK_FIELDS.jobTitle)}
									value={form.jobTitle}
									onChange={(e) => update('jobTitle', e.currentTarget.value)}
									maxLength={255}
									disabled={saving}
								/>
								<TaskDescEditor
									value={form.taskDesc}
									onChange={(html) => update('taskDesc', html)}
									disabled={saving}
									required={fieldRequired(REQUIRED_TASK_FIELDS.taskDesc)}
								/>
							</TaskFormSection>

							<TaskFormSection
								title='Contacts'
								required={fieldRequired(REQUIRED_TASK_FIELDS.contacts)}
								action={
									<Button
										variant='subtle'
										leftSection={<Plus size={14} />}
										onClick={() => setNewContactOpen(true)}
										disabled={saving}
									>
										New contact
									</Button>
								}
							>
								<Select
									size={inputSize}
									data={availableContactOptions}
									value={null}
									onChange={addContact}
									onKeyDown={singleMatchEnter(contactEnterMatch, addContact)}
									renderOption={renderOptionWithEnterHint(contactEnterMatch)}
									placeholder='Add contact'
									required={
										fieldRequired(REQUIRED_TASK_FIELDS.contacts) &&
										form.contactIds.length === 0
									}
									leftSection={<UserRound size={16} />}
									loading={contactLoading}
									comboboxProps={{ shadow: 'xl' }}
									maxDropdownHeight={400}
									styles={{
										dropdown: {
											backgroundColor: 'var(--mantine-color-gray-2)',
											border: '1px solid var(--mantine-primary-color-filled)',
										},
										option: {
											borderRadius: 4,
										},
									}}
									searchable
									clearable
									openOnFocus={contactDropdown.openOnFocus}
									dropdownOpened={contactDropdown.dropdownOpened}
									onDropdownClose={contactDropdown.onDropdownClose}
									searchValue={contactDropdown.search}
									onSearchChange={contactDropdown.onSearchChange}
									nothingFoundMessage={
										contactLoading ? 'Loading…' : 'No contacts found'
									}
									disabled={saving}
								/>
								{form.contactIds.length > 0 ? (
									<Stack gap={6} className='task-form-contacts'>
										{form.contactIds.map((contactId, index) => {
											const option = contactOptions.find(
												(o) => o.value === String(contactId),
											);
											const label = option?.label ?? `Contact #${contactId}`;
											const isPoc = index === 0;
											const receivesEmail =
												form.receiveEmailContactIds.includes(contactId);
											return (
												<div
													key={contactId}
													className={
														isPoc
															? 'task-form-contact task-form-contact--poc'
															: 'task-form-contact'
													}
												>
													<div className='task-form-contact-info'>
														<span className='task-form-contact-name'>
															{label}
														</span>
														{isPoc ? (
															<span className='task-form-contact-poc'>POC</span>
														) : null}
													</div>
													<Switch
														size='sm'
														label='Email'
														checked={receivesEmail}
														onChange={(e) => {
															const checked = e.currentTarget.checked;
															setForm((prev) => {
																const has =
																	prev.receiveEmailContactIds.includes(
																		contactId,
																	);
																if (checked && !has) {
																	return {
																		...prev,
																		receiveEmailContactIds: [
																			...prev.receiveEmailContactIds,
																			contactId,
																		],
																	};
																}
																if (!checked && has) {
																	return {
																		...prev,
																		receiveEmailContactIds:
																			prev.receiveEmailContactIds.filter(
																				(id) => id !== contactId,
																			),
																	};
																}
																return prev;
															});
														}}
														disabled={saving}
														styles={switchAlignStyles}
													/>
													<ActionIcon
														variant='subtle'
														color='gray'
														size='sm'
														aria-label={`Remove ${label}`}
														onClick={() => {
															setForm((prev) => {
																const contactIds = prev.contactIds.filter(
																	(id) => id !== contactId,
																);
																return {
																	...prev,
																	contactIds,
																	pocContactId: resolvePocContactId(contactIds),
																	receiveEmailContactIds:
																		prev.receiveEmailContactIds.filter((id) =>
																			contactIds.includes(id),
																		),
																};
															});
														}}
														disabled={saving}
													>
														<Trash2 size={14} />
													</ActionIcon>
												</div>
											);
										})}
									</Stack>
								) : null}
							</TaskFormSection>

							<TaskFormSection
								title='Destination'
								action={
									<Button
										variant='subtle'
										leftSection={<Plus size={14} />}
										onClick={openNewAddress}
										disabled={saving}
									>
										New address
									</Button>
								}
							>
								<Autocomplete
									size={inputSize}
									data={addressOptions.map(({ value, label }) => ({
										value,
										label,
									}))}
									value={form.destinationAddressName}
									label={
										fieldRequired(REQUIRED_TASK_FIELDS.destinationName)
											? 'Venue'
											: undefined
									}
									required={fieldRequired(REQUIRED_TASK_FIELDS.destinationName)}
									onChange={(name) => {
										addressDropdown.onSearchChange(name);
										setForm((prev) => {
											const linked =
												prev.destinationAddressId != null
													? addressOptions.find(
															(a) =>
																a.value === String(prev.destinationAddressId),
														)
													: undefined;
											return {
												...prev,
												destinationAddressName: name,
												// Keep link when Autocomplete echoes the selected label after pick.
												destinationAddressId:
													linked?.label === name
														? prev.destinationAddressId
														: null,
											};
										});
									}}
									onOptionSubmit={(value) => {
										addressDropdown.suppressNextSearchOpen();
										const selected = addressOptions.find(
											(a) => a.value === value,
										);
										if (!selected) return;
										setForm((prev) => ({
											...prev,
											destinationAddressId: Number(selected.value),
											destinationAddressName: selected.label,
											destinationAddress: selected.streetLine,
											destinationBuilding: selected.building,
											destinationNotes: selected.notes,
											destinationLatitude: selected.latitude,
											destinationLongitude: selected.longitude,
										}));
									}}
									placeholder={addressLoading ? 'Loading venues…' : 'Venue'}
									leftSection={<Building2 size={16} />}
									loading={addressLoading}
									clearable
									openOnFocus={addressDropdown.openOnFocus}
									dropdownOpened={addressDropdown.dropdownOpened}
									onDropdownClose={addressDropdown.onDropdownClose}
									comboboxProps={{ shadow: 'xl' }}
									maxDropdownHeight={400}
									styles={{
										dropdown: {
											backgroundColor: 'var(--mantine-color-gray-2)',
											border: '1px solid var(--mantine-primary-color-filled)',
										},
										option: {
											borderRadius: 4,
										},
									}}
									disabled={saving}
								/>
								{form.destinationAddressId == null ? (
									<AddressPlaceInput
										streetLine={form.destinationAddress}
										addressName={form.destinationAddressName}
										building={form.destinationBuilding}
										disabled={saving}
										required={fieldRequired(
											REQUIRED_TASK_FIELDS.destinationAddress,
										)}
										onStreetLineChange={(value) => {
											setForm((prev) => ({
												...prev,
												destinationAddress: value,
												destinationLatitude: null,
												destinationLongitude: null,
											}));
										}}
										onResolved={(place: ResolvedPlace | null) => {
											if (!place) {
												setForm((prev) => ({
													...prev,
													destinationLatitude: null,
													destinationLongitude: null,
												}));
												return;
											}
											setForm((prev) => ({
												...prev,
												destinationAddress: place.streetLine,
												destinationAddressName:
													place.addressName ?? prev.destinationAddressName,
												destinationLatitude: place.latitude,
												destinationLongitude: place.longitude,
											}));
										}}
									/>
								) : (
									<TextInput
										size={inputSize}
										placeholder='Street address'
										label={
											fieldRequired(REQUIRED_TASK_FIELDS.destinationAddress)
												? 'Street address'
												: undefined
										}
										required={fieldRequired(
											REQUIRED_TASK_FIELDS.destinationAddress,
										)}
										value={form.destinationAddress}
										readOnly
										leftSection={<MapPin size={16} />}
										disabled={saving}
									/>
								)}
								<TextInput
									size={inputSize}
									placeholder='Building, floor and room'
									label={
										fieldRequired(REQUIRED_TASK_FIELDS.destinationBuilding)
											? 'Building, floor and room'
											: undefined
									}
									required={fieldRequired(
										REQUIRED_TASK_FIELDS.destinationBuilding,
									)}
									value={form.destinationBuilding}
									onChange={(e) => {
										const value = e.currentTarget.value;
										setForm((prev) => ({
											...prev,
											destinationBuilding: value,
										}));
									}}
									leftSection={<Building2 size={16} />}
									rightSection={textClearSection(
										form.destinationBuilding.length > 0,
										() =>
											setForm((prev) => ({
												...prev,
												destinationBuilding: '',
											})),
										saving,
									)}
									rightSectionPointerEvents='auto'
									disabled={saving}
								/>
								<Textarea
									ref={destinationNotesRef}
									size={inputSize}
									placeholder='Instructions or notes'
									label={
										fieldRequired(REQUIRED_TASK_FIELDS.destinationNotes)
											? 'Destination notes'
											: undefined
									}
									required={fieldRequired(
										REQUIRED_TASK_FIELDS.destinationNotes,
									)}
									minRows={2}
									resize='vertical'
									value={form.destinationNotes}
									onChange={(e) => {
										const value = e.currentTarget.value;
										setForm((prev) => ({
											...prev,
											destinationNotes: value,
										}));
									}}
									leftSection={<StickyNote size={16} />}
									leftSectionProps={{
										style: { alignItems: 'flex-start', paddingTop: 10 },
									}}
									rightSection={textClearSection(
										form.destinationNotes.length > 0,
										() =>
											setForm((prev) => ({
												...prev,
												destinationNotes: '',
											})),
										saving,
									)}
									rightSectionPointerEvents='auto'
									disabled={saving}
								/>
							</TaskFormSection>
						</div>

						<div className='task-form-col'>
							<TaskFormSection title='Schedule'>
								<SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
									<DateTimePicker
										size={inputSize}
										label='Complete After'
										required={fieldRequired(
											REQUIRED_TASK_FIELDS.afterDateTime,
										)}
										valueFormat='dddd, MMMM DD, h:mm A'
										placeholder='Pick date and time'
										value={toDateTimePickerValue(form.afterDateTime)}
										onChange={(v) =>
											update('afterDateTime', fromDateTimePickerValue(v))
										}
										leftSection={<Calendar size={16} />}
										clearable
										timePickerProps={dateTimePickerTimeProps}
										disabled={saving}
									/>
									<DateTimePicker
										size={inputSize}
										label='Complete Before'
										required={fieldRequired(
											REQUIRED_TASK_FIELDS.beforeDateTime,
										)}
										valueFormat='dddd, MMMM DD, h:mm A'
										placeholder='Pick date and time'
										value={toDateTimePickerValue(form.beforeDateTime)}
										onChange={(v) =>
											update('beforeDateTime', fromDateTimePickerValue(v))
										}
										leftSection={<Calendar size={16} />}
										clearable
										timePickerProps={dateTimePickerTimeProps}
										disabled={saving}
									/>
								</SimpleGrid>
							</TaskFormSection>

							<TaskFormSection title=' '>
								<MultiSelect
									size={inputSize}
									label='Assign To'
									required={fieldRequired(REQUIRED_TASK_FIELDS.crew)}
									data={crewOptions}
									value={form.crewMemberIds}
									onChange={setCrewMemberIds}
									onKeyDown={singleMatchEnter(crewEnterMatch, (userId) => {
										crewDropdown.clearSearch();
										setCrewMemberIds([...form.crewMemberIds, userId]);
									})}
									renderOption={renderOptionWithEnterHint(crewEnterMatch)}
									placeholder={
										form.crewMemberIds.length === 0
											? 'Crew not assigned'
											: undefined
									}
									leftSection={<Users size={16} />}
									loading={crewLoading}
									comboboxProps={{ shadow: 'xl' }}
									maxDropdownHeight={400}
									styles={{
										dropdown: {
											backgroundColor: 'var(--mantine-color-gray-2)',
											border: '1px solid var(--mantine-primary-color-filled)',
										},
										option: {
											borderRadius: 4,
										},
									}}
									searchable
									clearable
									hidePickedOptions
									openOnFocus={crewDropdown.openOnFocus}
									dropdownOpened={crewDropdown.dropdownOpened}
									onDropdownClose={crewDropdown.onDropdownClose}
									searchValue={crewDropdown.search}
									onSearchChange={crewDropdown.onSearchChange}
									nothingFoundMessage={
										crewLoading ? 'Loading…' : 'No crew members found'
									}
									disabled={saving}
								/>
								{form.crewMemberIds.length > 0 ? (
									<Stack gap={6} className='task-form-crew'>
										{form.crewMemberIds.map((userId, index) => {
											const option = crewOptions.find(
												(o) => o.value === userId,
											);
											const label = option?.label ?? userId;
											const isLead = index === 0;
											return (
												<div
													key={userId}
													className={
														isLead
															? 'task-form-crew-member task-form-crew-member--lead'
															: 'task-form-crew-member'
													}
												>
													<div className='task-form-crew-member-info'>
														<span className='task-form-crew-member-name'>
															{label}
														</span>
														<span className='task-form-crew-member-role'>
															{isLead ? 'Lead' : 'Sub'}
														</span>
													</div>
													<ActionIcon
														variant='subtle'
														color='gray'
														size='sm'
														aria-label={`Remove ${label}`}
														onClick={() => {
															setForm((prev) => {
																const crewMemberIds = prev.crewMemberIds.filter(
																	(id) => id !== userId,
																);
																return {
																	...prev,
																	crewMemberIds,
																	leadCrewMemberId:
																		resolveLeadCrewMemberId(crewMemberIds),
																};
															});
														}}
														disabled={saving}
													>
														<Trash2 size={14} />
													</ActionIcon>
												</div>
											);
										})}
									</Stack>
								) : null}

								{customFieldDefs.length > 0 ? (
									<CustomFieldStack
										defs={customFieldDefs}
										values={form.customFields}
										onChange={updateCustomField}
										disabled={saving}
										catalogs={{
											users: crewOptions,
											contacts: contactOptions,
											addresses: addressOptions.map(({ value, label }) => ({
												value,
												label,
											})),
											tasks: taskOptions,
										}}
										loading={{
											users: crewLoading,
											contacts: contactLoading,
											addresses: addressLoading,
											tasks: taskLookupLoading,
										}}
									/>
								) : null}
							</TaskFormSection>

							<TaskFormSection title='Attachments'>
								{taskId != null ? (
									<TaskAttachments taskId={taskId} />
								) : (
									<Stack gap='sm' className='task-attachments'>
										<ul className='task-attachments-list'>
											{pendingFiles.map((file, index) => (
												<li
													key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
													className='task-attachments-item'
												>
													<div className='task-attachments-item-main'>
														<Text size='sm' fw={600} lineClamp={1}>
															{file.name}
														</Text>
														<Text size='xs' c='dimmed' mt={2}>
															{formatBytes(file.size)}
														</Text>
													</div>
													<UnstyledButton
														className='task-attachments-icon-btn task-attachments-icon-btn--danger'
														aria-label={`Remove ${file.name}`}
														disabled={saving}
														onClick={() =>
															setPendingFiles((prev) =>
																prev.filter((_, i) => i !== index),
															)
														}
													>
														<Trash2 size={16} strokeWidth={2} aria-hidden />
													</UnstyledButton>
												</li>
											))}
										</ul>

										<input
											ref={attachmentInputRef}
											id={attachmentInputId}
											type='file'
											accept={attachmentAcceptAttr()}
											multiple
											className='task-attachments-input'
											disabled={saving}
											onChange={(e) => addPendingFiles(e.target.files)}
										/>
										<Button
											variant='light'
											color='brand'
											leftSection={<Paperclip size={16} />}
											disabled={saving}
											onClick={() => attachmentInputRef.current?.click()}
										>
											Add attachment
										</Button>
									</Stack>
								)}
							</TaskFormSection>
						</div>
					</div>
				</div>

				<Group
					justify='flex-end'
					gap={6}
					wrap='wrap'
					className='task-form-footer'
				>
					<Button
						size='sm'
						variant='default'
						leftSection={<X size={16} />}
						onClick={handleClose}
						disabled={saving}
					>
						Close
					</Button>
					{!isEdit ? (
						<Button
							size='sm'
							variant='default'
							leftSection={<Plus size={16} />}
							onClick={() => void handleSave(true)}
							loading={saving}
						>
							Save & Add Another
						</Button>
					) : null}
					<Button
						size='sm'
						color='brand'
						leftSection={<Save size={16} />}
						onClick={() => void handleSave(false)}
						loading={saving}
					>
						{isEdit ? 'Save' : 'Save & Close'}
					</Button>
				</Group>
			</div>

			{!isEdit && step === 'pickType' ? (
				<div className='task-type-picker'>
					<div className='task-type-picker-inner'>
						<SimpleGrid cols={3} spacing='sm'>
							{taskTypeOptions.map(({ value, label, icon }) => {
								const Icon = resolveOrgTaskIcon(icon);
								return (
									<UnstyledButton
										key={value}
										type='button'
										className='task-type-picker-button'
										onClick={() => pickType(value)}
									>
										<Icon size={26} strokeWidth={1.75} aria-hidden />
										<span>{label}</span>
									</UnstyledButton>
								);
							})}
						</SimpleGrid>
					</div>
				</div>
			) : null}

			<NewContactModal
				opened={newContactOpen}
				onClose={() => setNewContactOpen(false)}
				isEdit={false}
				allowAddAnother={false}
				onSave={handleCreateContact}
				zIndex={400}
			/>
			<NewAddressModal
				opened={newAddressOpen}
				onClose={() => {
					setNewAddressOpen(false);
					setAddressSeed(null);
				}}
				initialValues={addressSeed}
				isEdit={false}
				allowAddAnother={false}
				onSave={handleCreateAddress}
				zIndex={400}
			/>
		</KeyboardAwareModal>
	);
}
