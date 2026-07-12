import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

// Shared delete/confirm dialog — wraps Modal with the Cancel/Confirm footer
// pattern repeated across Accounts, Transactions, Budgets, Bills, Goals, Debts.
// <ConfirmDialog open title body confirmLabel="Delete" onConfirm={...} onCancel={...} />
export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  subtitle,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  size = 'sm',
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} subtitle={subtitle} size={size}>
      {body && <p className="text-sm text-muted">{body}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
