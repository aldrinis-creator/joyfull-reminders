import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useLanguage";
import { phoneSchema } from "@/lib/otp.schemas";

/** India is the default dial code, matching the sign-in page. */
export const DEFAULT_DIAL_CODE = "+91";

export function isValidPhone(value: string): boolean {
  return phoneSchema.safeParse(value.replace(/[\s-]/g, "")).success;
}

/** Empty is allowed (optional field); anything typed must carry a country code. */
export function isPhoneAcceptable(value: string): boolean {
  const v = value.trim();
  if (!v || v === DEFAULT_DIAL_CODE) return true;
  return isValidPhone(v);
}

/** Stored form: no spaces or dashes, empty when nothing was really entered. */
export function normalizePhone(value: string): string | null {
  const v = value.replace(/[\s-]/g, "").trim();
  if (!v || v === DEFAULT_DIAL_CODE) return null;
  return v;
}

/** Phone input that insists on a country code, e.g. +919876543210. */
export function PhoneField({
  id,
  label,
  value,
  onChange,
  hint,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  className?: string;
}) {
  const t = useT();
  const invalid = !isPhoneAcceptable(value);

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        maxLength={20}
        aria-invalid={invalid}
        onFocus={() => {
          if (!value.trim()) onChange(DEFAULT_DIAL_CODE);
        }}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next && !next.startsWith("+") ? `+${next.replace(/[^\d]/g, "")}` : next);
        }}
        placeholder="+919876543210"
        className="h-12"
      />
      {invalid ? (
        <p className="text-destructive text-xs font-medium">{t("phoneCountryError")}</p>
      ) : (
        <p className="text-muted-foreground text-xs">{hint ?? t("phoneCountryHint")}</p>
      )}
    </div>
  );
}
