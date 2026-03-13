import { useState, type ChangeEvent, type ReactElement } from 'react';

type NumberInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  'data-ui-focus'?: string;
};

export const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  className,
  placeholder,
  id,
  'aria-label': ariaLabel,
  'data-ui-focus': dataUiFocus,
}: NumberInputProps): ReactElement => {
  const [textValue, setTextValue] = useState(
    value === null ? '' : value.toString(),
  );
  const [prevPropValue, setPrevPropValue] = useState(value);

  // Sync prop value to state smoothly
  if (value !== prevPropValue) {
    setPrevPropValue(value);

    let isEquivalent = false;
    if (value === null && textValue.trim() === '') {
      isEquivalent = true;
    } else if (value !== null && textValue.trim() !== '') {
      const parsed = Number(textValue);
      if (!Number.isNaN(parsed) && parsed === value) {
        isEquivalent = true;
      }
    }

    if (!isEquivalent) {
      setTextValue(value === null ? '' : value.toString());
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setTextValue(raw);

    if (raw.trim() === '') {
      onChange(null);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    // Apply min/max constraints on blur
    let finalValue = value;
    if (finalValue !== null) {
      if (min !== undefined && finalValue < min) {
        finalValue = min;
        onChange(min);
      } else if (max !== undefined && finalValue > max) {
        finalValue = max;
        onChange(max);
      }
    }

    // Re-format to clean representation on blur
    if (finalValue !== null) {
      setTextValue(finalValue.toString());
    } else {
      setTextValue('');
    }
  };

  return (
    <input
      type="number"
      value={textValue}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step ?? 'any'}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      id={id}
      aria-label={ariaLabel}
      data-ui-focus={dataUiFocus}
    />
  );
};
