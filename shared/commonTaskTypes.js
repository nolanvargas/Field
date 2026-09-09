/**
 * Suggested task types for org configuration. Selecting one fills name, plural, and icon.
 */

/** @type {readonly { name: string, pluralName: string, icon: string }[]} */
export const COMMON_TASK_TYPES = Object.freeze([
	{ name: 'Inspection', pluralName: 'Inspections', icon: 'ClipboardCheck' },
	{ name: 'Repair', pluralName: 'Repairs', icon: 'Wrench' },
	{ name: 'Replacement', pluralName: 'Replacements', icon: 'Replace' },
	{ name: 'Assessment', pluralName: 'Assessments', icon: 'ClipboardList' },
	{ name: 'Consultation', pluralName: 'Consultations', icon: 'MessageSquare' },
	{ name: 'Configuration', pluralName: 'Configurations', icon: 'Settings' },
	{ name: 'Activation', pluralName: 'Activations', icon: 'Power' },
	{ name: 'Deactivation', pluralName: 'Deactivations', icon: 'PowerOff' },
	{ name: 'Calibration', pluralName: 'Calibrations', icon: 'Gauge' },
	{ name: 'Upgrade', pluralName: 'Upgrades', icon: 'ArrowUpCircle' },
	{ name: 'Restoration', pluralName: 'Restorations', icon: 'RotateCcw' },
	{ name: 'Decommission', pluralName: 'Decommissions', icon: 'Archive' },
	{ name: 'Relocation', pluralName: 'Relocations', icon: 'MapPinned' },
	{ name: 'Transfer', pluralName: 'Transfers', icon: 'ArrowLeftRight' },
	{ name: 'Assembly', pluralName: 'Assemblies', icon: 'Boxes' },
	{ name: 'Disassembly', pluralName: 'Disassemblies', icon: 'Unlink' },
	{ name: 'Return', pluralName: 'Returns', icon: 'Undo2' },
	{ name: 'Exchange', pluralName: 'Exchanges', icon: 'Repeat2' },
	{ name: 'Audit', pluralName: 'Audits', icon: 'FileSearch' },
	{ name: 'Verification', pluralName: 'Verifications', icon: 'ShieldCheck' },
	{ name: 'Validation', pluralName: 'Validations', icon: 'BadgeCheck' },
	{ name: 'Measurement', pluralName: 'Measurements', icon: 'Ruler' },
	{ name: 'Diagnosis', pluralName: 'Diagnoses', icon: 'Stethoscope' },
	{ name: 'Evaluation', pluralName: 'Evaluations', icon: 'ClipboardPen' },
	{ name: 'Estimate', pluralName: 'Estimates', icon: 'Calculator' },
	{ name: 'Quote', pluralName: 'Quotes', icon: 'Receipt' },
	{ name: 'Approval', pluralName: 'Approvals', icon: 'ThumbsUp' },
	{ name: 'Authorization', pluralName: 'Authorizations', icon: 'KeyRound' },
	{ name: 'Cancellation', pluralName: 'Cancellations', icon: 'CircleX' },
	{ name: 'Demonstration', pluralName: 'Demonstrations', icon: 'Presentation' },
	{ name: 'Orientation', pluralName: 'Orientations', icon: 'GraduationCap' },
	{ name: 'Inventory', pluralName: 'Inventories', icon: 'Warehouse' },
	{ name: 'Replenishment', pluralName: 'Replenishments', icon: 'PackagePlus' },
	{ name: 'Certification', pluralName: 'Certifications', icon: 'Award' },
	{ name: 'Registration', pluralName: 'Registrations', icon: 'FilePlus' },
	{ name: 'Enrollment', pluralName: 'Enrollments', icon: 'UserPlus' },
]);

const BY_NAME = new Map(COMMON_TASK_TYPES.map((t) => [t.name.toLowerCase(), t]));

/**
 * @param {string} name
 * @returns {{ name: string, pluralName: string, icon: string } | undefined}
 */
export function commonTaskTypeByName(name) {
	return BY_NAME.get(String(name ?? '').trim().toLowerCase());
}
