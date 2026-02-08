// Feature #104: Split VisualConfig.tsx into logical modules
// FormField component extracted from VisualConfig.tsx

import React from 'react';

interface FormFieldProps {
 label: string;
 required?: boolean;
 children: React.ReactNode;
 hint?: string;
 error?: string;
}

/**
 * Form field wrapper component with label, hint, and error display
 */
export const FormField: React.FC<FormFieldProps> = ({ label, required, children, hint, error }) => (
 <div className="space-y-1">
 <label className="block text-sm font-medium text-foreground">
 {label}
 {required && <span className="text-destructive ml-1">*</span>}
 </label>
 {children}
 {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
 {error && <p className="text-xs text-destructive">{error}</p>}
 </div>
);

export default FormField;
