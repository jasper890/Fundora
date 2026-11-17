import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: Props) {
  const variantClass =
    variant === "secondary"
      ? "button secondary"
      : variant === "quiet"
        ? "button quiet"
        : "button";
  return <button className={`${variantClass} ${className}`.trim()} {...props} />;
}
