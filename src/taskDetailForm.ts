import type { NewTaskFormValues } from './components/NewTaskModal';
import type { UpdateTaskInput } from './api/tasks';
import type { CustomFieldValue, TaskDetail } from './types/task';

function toDateTimeLocal(iso: string | null): string {
	if (!iso) {
		const d = new Date();
		d.setSeconds(0, 0);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return toDateTimeLocal(null);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function taskDetailToFormValues(task: TaskDetail): NewTaskFormValues {
	// POC first so list order matches “first = POC”.
	const contacts = [...task.contacts].sort(
		(a, b) => Number(b.isPoc) - Number(a.isPoc),
	);
	const contactIds = contacts.map((c) => c.id);
	return {
		contactIds,
		pocContactId: contactIds[0] ?? null,
		receiveEmailContactIds: contacts
			.filter((c) => c.receivesEmail)
			.map((c) => c.id),
		taskType: task.taskType,
		taskTypeId: task.taskTypeId ?? null,
		externalKey: task.externalKey,
		jobTitle: task.jobTitle ?? '',
		taskDesc: task.description,
		destinationAddressId: task.destinationAddressId,
		destinationAddressName: task.destinationAddressName,
		destinationAddress: task.destinationAddress,
		destinationBuilding: task.destinationBuilding,
		destinationNotes: task.destinationNotes,
		destinationLatitude: task.destinationLatitude,
		destinationLongitude: task.destinationLongitude,
		afterDateTime: toDateTimeLocal(task.windowStartAt),
		beforeDateTime: toDateTimeLocal(task.windowEndAt),
		crewMemberIds: [...task.crewMembers]
			.sort((a, b) => Number(b.isLead) - Number(a.isLead))
			.map((m) => m.id),
		leadCrewMemberId:
			task.crewMembers.find((m) => m.isLead)?.id ??
			task.crewMembers[0]?.id ??
			null,
		customFields: { ...(task.customFields ?? {}) },
	};
}

export function buildUpdateTaskInput(
	values: NewTaskFormValues,
	customFieldPatch?: {
		touchedCustomFieldSlots: number[];
		clearedCustomFieldSlots: number[];
		customFields: Record<string, CustomFieldValue>;
	},
): UpdateTaskInput {
	if (!customFieldPatch) {
		return values;
	}
	return {
		...values,
		customFields: customFieldPatch.customFields,
		touchedCustomFieldSlots: customFieldPatch.touchedCustomFieldSlots,
		clearedCustomFieldSlots: customFieldPatch.clearedCustomFieldSlots,
	};
}
