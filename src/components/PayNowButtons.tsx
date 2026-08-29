import { Copy, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useLanguage";
import { paymentTarget, type PaymentShortcut } from "@/lib/pay-link";

/**
 * "Pay now" hand-off. Opens the biller's page or a UPI deep link — the app
 * itself never handles money.
 */
export function PayNowButtons({
  shortcut,
  tone = "default",
  size = "sm",
}: {
  shortcut: PaymentShortcut;
  tone?: "default" | "onDark";
  size?: "sm" | "lg";
}) {
  const t = useT();
  const target = paymentTarget(shortcut);
  if (!target) return null;

  const upiId = shortcut.upi_id?.trim();

  const buttonClass =
    tone === "onDark"
      ? "text-indigo-foreground border-white/40 bg-transparent hover:bg-white/10"
      : "";

  async function copyUpi() {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success(t("home.upiCopied"));
    } catch {
      toast.error(t("home.upiCopyFailed"));
    }
  }

  return (
    <>
      <Button
        size={size === "lg" ? "lg" : "sm"}
        variant="outline"
        className={`${size === "lg" ? "h-14 text-base" : "h-11"} ${buttonClass}`}
        onClick={() => {
          window.open(target.href, target.kind === "link" ? "_blank" : "_self", "noopener,noreferrer");
        }}
      >
        <IndianRupee className="size-4" aria-hidden /> {t("home.payNow")}
      </Button>
      {upiId ? (
        <Button
          size={size === "lg" ? "lg" : "sm"}
          variant="outline"
          className={`${size === "lg" ? "h-14 text-base" : "h-11"} ${buttonClass}`}
          onClick={copyUpi}
          title={upiId}
        >
          <Copy className="size-4" aria-hidden /> {t("home.copyUpi")}
        </Button>
      ) : null}
    </>
  );
}
