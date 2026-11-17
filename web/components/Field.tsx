import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export function Field({
  label,
  hint,
  error,
  id,
  "aria-describedby": describedBy,
  ...props
}: Props) {
  const fieldId = id ?? props.name;
  const hintId = hint && fieldId ? fieldId + "-hint" : undefined;
  const errorId = error && fieldId ? fieldId + "-error" : undefined;
  const descriptionIds =
    [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        aria-describedby={descriptionIds}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint ? <small id={hintId}>{hint}</small> : null}
      {error ? (
        <small id={errorId} className="field-error">
          {error}
        </small>
      ) : null}
    </div>
  );
}
