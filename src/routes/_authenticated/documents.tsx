import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import { useFamilyMembers } from "@/lib/queries";
import { formatDate } from "@/lib/ereminder";
import {
  ACCEPTED_DOCUMENT_TYPES,
  DOCUMENTS_BUCKET,
  DOC_TYPES,
  MAX_DOCUMENT_BYTES,
  createExpiryReminder,
  daysUntil,
  deleteExpiryReminder,
  docTypeLabel,
  expiryTone,
  signedDocumentUrl,
  sortDocuments,
  type DocType,
  type DocumentRow,
} from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Document shelf — e-Reminder" },
      {
        name: "description",
        content:
          "Keep insurance, PUC, ID and warranty documents in one private place, with automatic expiry reminders.",
      },
      { property: "og:title", content: "Document shelf — e-Reminder" },
      {
        property: "og:description",
        content: "Your important papers, safely stored with expiry reminders.",
      },
    ],
  }),
  component: DocumentsPage,
});

function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*");
      if (error) throw error;
      return sortDocuments((data ?? []) as DocumentRow[]);
    },
  });
}

function DocumentsPage() {
  const t = useT();
  const { data: docs } = useDocuments();
  const [adding, setAdding] = useState(false);

  return (
    <AppShell
      title={t("documents.title")}
      subtitle={t("documents.subtitle")}
      action={
        <Button
          size="icon"
          variant="secondary"
          className="size-12 rounded-2xl"
          aria-label={t("documents.add")}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-6" aria-hidden />
        </Button>
      }
    >
      <div className="space-y-3">
        {docs && docs.length === 0 ? (
          <p className="text-muted-foreground bg-card shadow-card rounded-3xl p-5 text-sm">
            {t("documents.empty")}
          </p>
        ) : null}
        {(docs ?? []).map((doc) => (
          <DocumentRowCard key={doc.id} doc={doc} />
        ))}
        <Button className="h-14 w-full rounded-2xl" onClick={() => setAdding(true)}>
          <Plus className="size-5" aria-hidden /> {t("documents.add")}
        </Button>
      </div>

      <AddDocumentDialog open={adding} onOpenChange={setAdding} />
    </AppShell>
  );
}

function DocumentRowCard({ doc }: { doc: DocumentRow }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const tone = expiryTone(doc.expiry_date);

  const open = async () => {
    const url = await signedDocumentUrl(doc.file_path);
    if (!url) {
      toast.error(t("documents.errOpen"));
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const remove = async () => {
    if (!window.confirm(t("documents.confirmDelete"))) return;
    setBusy(true);
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
    if (doc.reminder_id) await deleteExpiryReminder(doc.reminder_id);
    await supabase.from("documents").delete().eq("id", doc.id);
    setBusy(false);
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    toast.success(t("documents.deleted"));
  };

  const expiryText = () => {
    if (!doc.expiry_date) return t("documents.noExpiry");
    const days = daysUntil(doc.expiry_date);
    if (days < 0) return t("documents.expiredOn", { date: formatDate(doc.expiry_date) });
    if (days === 0) return t("documents.expiringToday");
    if (days <= 30) return t("documents.expiringSoon", { count: days });
    return t("documents.expiresOn", { date: formatDate(doc.expiry_date) });
  };

  return (
    <section
      className={`bg-card shadow-card space-y-3 rounded-3xl p-5 ${
        tone === "past"
          ? "border-destructive border-2"
          : tone === "soon"
            ? "border-accent border-2"
            : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <FileText className="text-primary mt-1 size-6 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{doc.title}</p>
          <p className="text-muted-foreground text-sm">{docTypeLabel(doc.doc_type)}</p>
          <p
            className={`mt-1 text-sm font-medium ${
              tone === "past"
                ? "text-destructive"
                : tone === "soon"
                  ? "text-accent-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {expiryText()}
          </p>
          {doc.notes ? <p className="text-muted-foreground mt-1 text-sm">{doc.notes}</p> : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-12 flex-1" onClick={() => void open()}>
          {t("documents.openFile")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive size-12"
          disabled={busy}
          aria-label={t("documents.delete")}
          onClick={() => void remove()}
        >
          <Trash2 className="size-5" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

function AddDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: members } = useFamilyMembers();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("insurance");
  const [memberId, setMemberId] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDocType("insurance");
    setMemberId("");
    setExpiry("");
    setNotes("");
    setFile(null);
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error(t("documents.errTitle"));
      return;
    }
    if (!file) {
      toast.error(t("documents.errFile"));
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setSaving(false);
      toast.error(t("documents.errSave"));
      return;
    }

    const familyMemberId = memberId || null;
    const reminderId = expiry
      ? await createExpiryReminder({
          userId,
          title: title.trim(),
          docType,
          expiry,
          familyMemberId,
          notes: notes.trim() || null,
        })
      : null;

    const { error } = await supabase.from("documents").insert({
      user_id: userId,
      title: title.trim(),
      doc_type: docType,
      family_member_id: familyMemberId,
      file_path: path,
      expiry_date: expiry || null,
      notes: notes.trim() || null,
      reminder_id: reminderId,
    });
    setSaving(false);
    if (error) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      if (reminderId) await deleteExpiryReminder(reminderId);
      toast.error(t("documents.errSave"));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    toast.success(t("documents.saved"));
    reset();
    onOpenChange(false);
  };

  const pickFile = (chosen: File | undefined) => {
    if (!chosen) return;
    const ok = chosen.type.startsWith("image/") || chosen.type === "application/pdf";
    if (!ok) {
      toast.error(t("documents.errFileType"));
      return;
    }
    if (chosen.size > MAX_DOCUMENT_BYTES) {
      toast.error(t("documents.errFileBig"));
      return;
    }
    setFile(chosen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b p-5">
          <DialogTitle>{t("documents.addTitle")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-2">
            <Label htmlFor="doc-title">{t("documents.fieldTitle")}</Label>
            <Input
              id="doc-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{t("documents.fieldTitleHelp")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("documents.fieldType")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {DOC_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={docType === type ? "default" : "outline"}
                  aria-pressed={docType === type}
                  className="h-12 justify-start"
                  onClick={() => setDocType(type)}
                >
                  {docTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-member">{t("documents.fieldMember")}</Label>
            <select
              id="doc-member"
              className="border-input bg-background h-12 w-full rounded-md border px-3"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">{t("documents.memberNone")}</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-expiry">{t("documents.fieldExpiry")}</Label>
            <Input
              id="doc-expiry"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{t("documents.fieldExpiryHelp")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-notes">{t("documents.fieldNotes")}</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("documents.fieldFile")}</Label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_DOCUMENT_TYPES}
              className="hidden"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                pickFile(chosen);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-5" aria-hidden /> {t("documents.chooseFile")}
            </Button>
            {file ? (
              <p className="text-muted-foreground text-sm">
                {t("documents.fileChosen", { name: file.name })}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t p-5">
          <Button variant="outline" className="h-12" onClick={() => onOpenChange(false)}>
            {t("documents.cancel")}
          </Button>
          <Button className="h-12" disabled={saving} onClick={() => void submit()}>
            {saving ? t("documents.saving") : t("documents.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
