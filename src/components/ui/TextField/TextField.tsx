import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon/Icon';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  /** Always a real label (docs/03 §6.4); it may be visually hidden when the design shows none. */
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly icon?: IconName;
  /** Validation message, announced and linked to the input; `null` when valid. */
  readonly error?: string | null;
  /** Controls placed inside the field box after the input (e.g. a hidden submit button). */
  readonly trailing?: ReactNode;
  readonly className?: string | undefined;
  /** Extra class on the bordered field box, for effects like the G11 shimmer. */
  readonly fieldClassName?: string | undefined;
}

/** Text input from Figma 27:90 "Kolom cari": 14px 18px padding, 16px radius, token-driven per mode. */
export function TextField({
  label,
  hideLabel = false,
  icon,
  error = null,
  trailing,
  className,
  fieldClassName,
  ...inputProps
}: TextFieldProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </label>
      <div
        className={[styles.field, fieldClassName].filter(Boolean).join(' ')}
        data-invalid={error ? true : undefined}
      >
        {icon && <Icon name={icon} size={24} className={styles.icon} />}
        <input
          {...inputProps}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {trailing}
      </div>
      <p id={errorId} className={styles.error} role="alert">
        {error}
      </p>
    </div>
  );
}
