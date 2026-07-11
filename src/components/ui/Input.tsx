import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const fieldBase =
  "w-full rounded-[0.625rem] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input ref={ref} className={`${fieldBase} ${className}`} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    className={`${fieldBase} resize-none ${className}`}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", ...props }, ref) => (
  <select ref={ref} className={`${fieldBase} ${className}`} {...props} />
));
Select.displayName = "Select";

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </span>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-danger">{children}</p>;
}
