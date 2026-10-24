import { useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { displayDate, parseDisplayDate } from "../domain/dates";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  label: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  max?: string;
  min?: string;
};

export function DateInput({
  value,
  onChange,
  label,
  name,
  required,
  disabled,
  max,
  min,
}: Props) {
  const [draftState, setDraft] = useState({
    source: value,
    text: displayDate(value),
  });
  const draft =
    draftState.source === value ? draftState.text : displayDate(value);
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);

  return (
    <div className="date-entry">
      <input
        ref={textInput}
        id={id}
        aria-label={label}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd-mm-yyyy"
        pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
        title="Enter a real date as dd-mm-yyyy"
        required={required}
        disabled={disabled}
        value={draft}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
          const next =
            digits.length > 4
              ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
              : digits.length > 2
                ? `${digits.slice(0, 2)}-${digits.slice(2)}`
                : digits;
          setDraft({ source: value, text: next });
          event.target.setCustomValidity("");
          if (!next) onChange("");
          else {
            const parsed = parseDisplayDate(next);
            if (parsed) onChange(parsed);
          }
        }}
        onBlur={(event) => {
          const parsed = parseDisplayDate(draft);
          event.target.setCustomValidity(
            draft && !parsed
              ? "Enter a real date as dd-mm-yyyy"
              : parsed && max && parsed > max
                ? `Choose a date on or before ${displayDate(max)}`
                : parsed && min && parsed < min
                  ? `Choose a date on or after ${displayDate(min)}`
                  : "",
          );
        }}
      />
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        className="date-entry-picker"
        aria-label={`Open calendar for ${label.toLowerCase()}`}
        disabled={disabled}
        onClick={() => {
          if (picker.current?.showPicker) picker.current.showPicker();
          else picker.current?.click();
        }}
      >
        <CalendarDays size={17} />
      </button>
      <input
        ref={picker}
        className="date-entry-native"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        max={max}
        min={min}
        onChange={(event) => {
          textInput.current?.setCustomValidity("");
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
