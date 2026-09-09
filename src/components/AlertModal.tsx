import { Button, Group, Text } from '@mantine/core';
import { KeyboardAwareModal } from './KeyboardAwareModal';

export type AlertModalKind = 'alert' | 'confirm' | 'unsavedChanges';

export type AlertModalProps = {
	opened: boolean;
	message: string;
	kind?: AlertModalKind;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	onSaveChanges?: () => void;
	onDiscardChanges?: () => void;
};

/** Compact stand-in for `window.alert` / `window.confirm`. */
export function AlertModal({
	opened,
	message,
	kind = 'alert',
	confirmLabel = 'OK',
	cancelLabel = 'Cancel',
	danger = false,
	onConfirm,
	onCancel,
	onSaveChanges,
	onDiscardChanges,
}: AlertModalProps) {
	const isConfirm = kind === 'confirm';
	const isUnsavedChanges = kind === 'unsavedChanges';

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={
				isUnsavedChanges ? onCancel : isConfirm ? onCancel : onConfirm
			}
			withCloseButton={false}
			size={isUnsavedChanges ? 360 : 280}
			centered
			padding='sm'
			zIndex={400}
			overlayProps={{ backgroundOpacity: 0.45 }}
			styles={{
				body: { paddingTop: 12 },
			}}
		>
			<Text size='sm'>{message}</Text>
			<Group
				justify={isUnsavedChanges ? 'stretch' : 'flex-end'}
				gap={8}
				mt='sm'
				grow={isUnsavedChanges}
				wrap={isUnsavedChanges ? undefined : 'nowrap'}
			>
				{isUnsavedChanges ? (
					<>
						<Button variant='default' onClick={onDiscardChanges}>
							Discard changes
						</Button>
						<Button onClick={onSaveChanges}>Save changes</Button>
					</>
				) : null}
				{isConfirm ? (
					<Button variant='default' onClick={onCancel}>
						{cancelLabel}
					</Button>
				) : null}
				{!isUnsavedChanges ? (
					<Button
						color={danger ? 'red' : undefined}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				) : null}
			</Group>
		</KeyboardAwareModal>
	);
}
