/**
 * Feature #131: Unified FormField Component
 * Consistent form field styling with label, input, and error handling.
 *
 * Usage:
 * ```tsx
 * <FormField
 *   label="Email"
 *   name="email"
 *   type="email"
 *   value={email}
 *   onChange={setEmail}
 *   error={errors.email}
 *   required
 * />
 *
 * <FormField
 *   label="Description"
 *   name="description"
 *   as="textarea"
 *   value={description}
 *   onChange={setDescription}
 *   rows={4}
 * />
 *
 * <FormField
 *   label="Category"
 *   name="category"
 *   as="select"
 *   value={category}
 *   onChange={setCategory}
 *   options={[
 *     { value: 'a', label: 'Option A' },
 *     { value: 'b', label: 'Option B' },
 *   ]}
 * />
 * ```
 */

import React, { memo, forwardRef, useId } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface BaseFormFieldProps {
  /** Field label */
  label: string;
  /** Field name for form submission */
  name: string;
  /** Current value */
  value: string | number;
  /** Value change handler */
  onChange: (value: string) => void;
  /** Error message */
  error?: string;
  /** Helper text below the field */
  helperText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class for the container */
  className?: string;
  /** Additional class for the input */
  inputClassName?: string;
  /** Label position */
  labelPosition?: 'top' | 'left' | 'floating';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Blur handler */
  onBlur?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

interface InputFormFieldProps extends BaseFormFieldProps {
  /** Render as input (default) */
  as?: 'input';
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local';
  /** Minimum value (for number/date) */
  min?: number | string;
  /** Maximum value (for number/date) */
  max?: number | string;
  /** Step value (for number) */
  step?: number | string;
  /** Input pattern */
  pattern?: string;
  /** Auto-complete */
  autoComplete?: string;
  /** Left icon/addon */
  leftAddon?: React.ReactNode;
  /** Right icon/addon */
  rightAddon?: React.ReactNode;
}

interface TextareaFormFieldProps extends BaseFormFieldProps {
  /** Render as textarea */
  as: 'textarea';
  /** Number of rows */
  rows?: number;
  /** Allow resize */
  resize?: boolean;
}

interface SelectFormFieldProps extends BaseFormFieldProps {
  /** Render as select */
  as: 'select';
  /** Select options */
  options: FormFieldOption[];
  /** Allow empty selection */
  allowEmpty?: boolean;
  /** Empty option label */
  emptyLabel?: string;
}

interface CheckboxFormFieldProps extends Omit<BaseFormFieldProps, 'value' | 'onChange'> {
  /** Render as checkbox */
  as: 'checkbox';
  /** Checked state */
  checked: boolean;
  /** Change handler for checkbox */
  onCheckedChange: (checked: boolean) => void;
}

export type FormFieldProps =
  | InputFormFieldProps
  | TextareaFormFieldProps
  | SelectFormFieldProps
  | CheckboxFormFieldProps;

// =============================================================================
// SIZE CLASSES
// =============================================================================

const sizeClasses = {
  sm: {
    input: 'px-2.5 py-1.5 text-sm',
    label: 'text-sm',
    container: 'gap-1',
  },
  md: {
    input: 'px-3 py-2 text-base',
    label: 'text-sm',
    container: 'gap-1.5',
  },
  lg: {
    input: 'px-4 py-3 text-lg',
    label: 'text-base',
    container: 'gap-2',
  },
};

// =============================================================================
// BASE INPUT STYLES
// =============================================================================

const baseInputClasses = `
  w-full rounded-md border border-border bg-background text-foreground
  placeholder:text-muted-foreground
  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
  disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted
  transition-colors
`.trim().replace(/\s+/g, ' ');

const errorInputClasses = 'border-destructive focus:ring-destructive/20 focus:border-destructive';

// =============================================================================
// FORM FIELD COMPONENT
// =============================================================================

export const FormField = memo(forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FormFieldProps>(
  function FormField(props, ref) {
    const generatedId = useId();
    const id = `field-${props.name}-${generatedId}`;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const {
      label,
      name,
      error,
      helperText,
      required = false,
      disabled = false,
      readOnly = false,
      className = '',
      inputClassName = '',
      labelPosition = 'top',
      size = 'md',
      onBlur,
      onFocus,
      autoFocus,
    } = props;

    const sizeClass = sizeClasses[size];
    const hasError = !!error;

    // Container classes based on label position
    const containerClasses =
      labelPosition === 'left'
        ? `flex items-center gap-4 ${className}`
        : `flex flex-col ${sizeClass.container} ${className}`;

    // Label element
    const labelElement = (
      <label
        htmlFor={id}
        className={`font-medium text-foreground ${sizeClass.label} ${labelPosition === 'left' ? 'min-w-[120px]' : ''}`}
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
    );

    // Error and helper text
    const messageElement = (
      <>
        {hasError && (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!hasError && helperText && (
          <p id={helperId} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </>
    );

    // Render checkbox
    if (props.as === 'checkbox') {
      const { checked, onCheckedChange } = props as CheckboxFormFieldProps;
      return (
        <div className={`flex items-start gap-3 ${className}`}>
          <input
            id={id}
            type="checkbox"
            name={name}
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          />
          <div className="flex flex-col gap-0.5">
            <label htmlFor={id} className={`font-medium text-foreground ${sizeClass.label} cursor-pointer`}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </label>
            {messageElement}
          </div>
        </div>
      );
    }

    // Common input wrapper for input, textarea, select
    const inputClasses = `${baseInputClasses} ${sizeClass.input} ${hasError ? errorInputClasses : ''} ${inputClassName}`;

    // Render input
    if (props.as === 'input' || props.as === undefined) {
      const {
        type = 'text',
        value,
        onChange,
        placeholder,
        min,
        max,
        step,
        pattern,
        autoComplete,
        leftAddon,
        rightAddon,
      } = props as InputFormFieldProps;

      const inputElement = (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          id={id}
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          min={min}
          max={max}
          step={step}
          pattern={pattern}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onBlur={onBlur}
          onFocus={onFocus}
          className={leftAddon || rightAddon ? `flex-1 border-0 bg-transparent focus:ring-0 px-0 ${sizeClass.input}` : inputClasses}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
        />
      );

      return (
        <div className={containerClasses}>
          {labelElement}
          <div className="flex-1">
            {leftAddon || rightAddon ? (
              <div className={`flex items-center ${inputClasses}`}>
                {leftAddon && <span className="text-muted-foreground mr-2">{leftAddon}</span>}
                {inputElement}
                {rightAddon && <span className="text-muted-foreground ml-2">{rightAddon}</span>}
              </div>
            ) : (
              inputElement
            )}
            {messageElement}
          </div>
        </div>
      );
    }

    // Render textarea
    if (props.as === 'textarea') {
      const { value, onChange, placeholder, rows = 4, resize = true } = props as TextareaFormFieldProps;

      return (
        <div className={containerClasses}>
          {labelElement}
          <div className="flex-1">
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              id={id}
              name={name}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              readOnly={readOnly}
              rows={rows}
              autoFocus={autoFocus}
              onBlur={onBlur}
              onFocus={onFocus}
              className={`${inputClasses} ${resize ? 'resize-y' : 'resize-none'}`}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            />
            {messageElement}
          </div>
        </div>
      );
    }

    // Render select
    if (props.as === 'select') {
      const { value, onChange, options, allowEmpty = true, emptyLabel = 'Select...' } = props as SelectFormFieldProps;

      return (
        <div className={containerClasses}>
          {labelElement}
          <div className="flex-1">
            <select
              ref={ref as React.Ref<HTMLSelectElement>}
              id={id}
              name={name}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              disabled={disabled}
              autoFocus={autoFocus}
              onBlur={onBlur}
              onFocus={onFocus}
              className={inputClasses}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            >
              {allowEmpty && <option value="">{emptyLabel}</option>}
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
            {messageElement}
          </div>
        </div>
      );
    }

    return null;
  }
));

// =============================================================================
// HELPER EXPORTS
// =============================================================================

/**
 * Form error display component
 */
export const FormError = memo(function FormError({
  error,
  className = '',
}: {
  error?: string | null;
  className?: string;
}) {
  if (!error) return null;
  return <p className={`text-sm text-destructive ${className}`}>{error}</p>;
});

/**
 * Form field group for organizing related fields
 */
export const FormFieldGroup = memo(function FormFieldGroup({
  title,
  description,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-medium text-foreground">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
});

/**
 * Form actions container for submit/cancel buttons
 */
export const FormActions = memo(function FormActions({
  children,
  align = 'right',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'between';
  className?: string;
}) {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div className={`flex flex-wrap gap-3 ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
});

export default FormField;
