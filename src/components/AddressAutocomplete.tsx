import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useLanguage";
import { resolveAddress, searchAddresses } from "@/lib/places.functions";
import type { AddressSuggestion, ResolvedAddress } from "@/lib/places.schemas";

function newSessionToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export type AddressAutocompleteProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onResolved: (address: ResolvedAddress) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
};

/**
 * Address field with Google-powered type-ahead. The API key never reaches the
 * browser — suggestions come from server functions. Typing by hand always works.
 */
export function AddressAutocomplete({
  id,
  label,
  value,
  onChange,
  onResolved,
  placeholder,
  multiline = false,
  hint,
}: AddressAutocompleteProps) {
  const t = useT();
  const listId = useId();
  const search = useServerFn(searchAddresses);
  const resolve = useServerFn(resolveAddress);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const sessionToken = useRef(newSessionToken());
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true);
      void search({ data: { query: q, sessionToken: sessionToken.current } })
        .then((res) => {
          if (cancelled) return;
          setUnavailable(Boolean(res.unavailable));
          setSuggestions(res.suggestions);
          setOpen(res.suggestions.length > 0);
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setUnavailable(true);
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, search]);

  const choose = async (s: AddressSuggestion) => {
    setOpen(false);
    setSuggestions([]);
    setBusy(true);
    try {
      const { address } = await resolve({
        data: { placeId: s.placeId, sessionToken: sessionToken.current },
      });
      sessionToken.current = newSessionToken();
      if (address) {
        skipNext.current = true;
        onChange(address.line);
        onResolved(address);
      } else {
        skipNext.current = true;
        onChange([s.primary, s.secondary].filter(Boolean).join(", "));
      }
    } finally {
      setBusy(false);
    }
  };

  const shared = {
    id,
    value,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onFocus: () => setOpen(suggestions.length > 0),
    onBlur: () => setTimeout(() => setOpen(false), 150),
    "aria-expanded": open,
    "aria-controls": listId,
    autoComplete: "off" as const,
    role: "combobox" as const,
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {multiline ? (
          <Textarea {...shared} rows={3} maxLength={400} className="w-full min-w-0" />
        ) : (
          <Input {...shared} maxLength={300} className="h-12 w-full min-w-0" />
        )}
        {busy ? (
          <Loader2
            className="text-muted-foreground pointer-events-none absolute top-3.5 right-3 size-4 animate-spin"
            aria-hidden
          />
        ) : null}
        {open && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="bg-popover absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border shadow-lg"
          >
            {suggestions.map((s) => (
              <li key={s.placeId} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-start gap-2 px-4 py-3 text-left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void choose(s)}
                >
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.primary}</span>
                    {s.secondary ? (
                      <span className="text-muted-foreground block truncate text-sm">
                        {s.secondary}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {unavailable ? (
        <p className="text-muted-foreground text-xs">
          {t("addressUnavailable")}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
