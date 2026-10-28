import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Check, ArrowUpRight, Dumbbell, CircleHelp } from 'lucide-react';

export type Page = 'home' | 'workout' | 'progress' | 'program' | 'settings';
export const AppContext = createContext<{
  navigate: (page: Page) => void;
  toast: (message: string) => void;
  start: (programId: string) => void;
  rest: (seconds: number) => void;
}>({ navigate: () => {}, toast: () => {}, start: () => {}, rest: () => {} });
export const useApp = () => useContext(AppContext);
export function Button({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <IconButton label="Fermer" onClick={close}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function NumberField({
  label,
  value,
  onValue,
  min = 0,
  max = 1000,
  step = 'any',
  ...props
}: {
  label: string;
  value: number | '';
  onValue: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'min' | 'max' | 'step'
>) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value !== '' && e.target.validity.valid) {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onValue(n);
          }
        }}
        onBlur={() => setText(String(value))}
        required
        {...props}
      />
    </label>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Dumbbell size={28} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export const CheckIcon = () => <Check size={16} strokeWidth={3} />;
export const GoIcon = () => <ArrowUpRight size={20} />;
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="note">
      <CircleHelp size={17} />
      <span>{children}</span>
    </div>
  );
}
