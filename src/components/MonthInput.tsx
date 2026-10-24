import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { displayMonth, parseDisplayMonth } from "../domain/dates";

export function MonthInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (month: string) => void;
  label: string;
}) {
  const [draftState, setDraft] = useState({
    source: value,
    text: displayMonth(value),
  });
  const draft =
    draftState.source === value ? draftState.text : displayMonth(value);
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="date-entry">
      <input
        aria-label={label}
        type="text"
        inputMode="numeric"
        placeholder="mm-yyyy"
        pattern="(0[1-9]|1[0-2])-[0-9]{4}"
        title="Enter a month as mm-yyyy"
        value={draft}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
          const next =
            digits.length > 2
              ? `${digits.slice(0, 2)}-${digits.slice(2)}`
              : digits;
          setDraft({ source: value, text: next });
          const parsed = parseDisplayMonth(next);
          if (parsed) onChange(parsed);
        }}
        onBlur={() => {
          if (!parseDisplayMonth(draft))
            setDraft({ source: value, text: displayMonth(value) });
        }}
      />
      <button
        type="button"
        className="date-entry-picker"
        aria-label={`Open calendar for ${label.toLowerCase()}`}
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
        type="month"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
