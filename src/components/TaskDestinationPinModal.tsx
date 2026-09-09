import { AddressPinModal } from './AddressPinModal';

type TaskDestinationPinModalProps = {
	taskId: number;
	destinationAddressName?: string | null;
	destinationAddress?: string | null;
	destinationBuilding?: string | null;
	opened: boolean;
	onClose: () => void;
	onSaved: () => void | Promise<void>;
	zIndex?: number;
};

export function TaskDestinationPinModal({
	taskId,
	destinationAddressName,
	destinationAddress,
	destinationBuilding,
	opened,
	onClose,
	onSaved,
	zIndex,
}: TaskDestinationPinModalProps) {
	const name = destinationAddressName?.trim() ?? '';
	const street = destinationAddress?.trim() ?? '';
	const label = name || street || `Task #${taskId}`;

	return (
		<AddressPinModal
			mode='task'
			id={taskId}
			label={label}
			addressName={destinationAddressName ?? undefined}
			streetLine={destinationAddress ?? undefined}
			building={destinationBuilding ?? undefined}
			opened={opened}
			onClose={onClose}
			onSaved={onSaved}
			zIndex={zIndex}
		/>
	);
}
