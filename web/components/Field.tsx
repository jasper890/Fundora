import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export function Field({ label, hint, error, id, ...props }: Props) {
  const fieldId = id ?? props.name;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} aria-invalid={error ? true : undefined} {...props} />
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}
