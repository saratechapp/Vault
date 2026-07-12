
// Marks a Field's label as mandatory with a trailing red asterisk. Shared so
// every form's "required" styling stays visually identical (originally
// local to NewTransactionModal.jsx).
export function RequiredLabel({ children }) {
  return <>{children} <span className="text-rose-500">*</span></>;
}

export default RequiredLabel;
