import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonClassName, type ButtonVariant } from './buttonClassName';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly children: ReactNode;
}

export function Button({ variant = 'accent', className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName(variant, className)} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  readonly variant?: ButtonVariant;
}

/** Navigation styled as a button; still a real link for the router, middle-click and screen readers. */
export function ButtonLink({ variant = 'accent', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName(variant, typeof className === 'string' ? className : undefined)}
      {...rest}
    >
      {children}
    </Link>
  );
}
