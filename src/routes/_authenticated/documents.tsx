import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
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
import { PhotoCapture, MAX_PHOTOS, type CapturedPhoto } from "@/components/PhotoCapture";
import { DocumentsPinGate } from "@/components/DocumentsPinGate";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import { useFamilyMembers } from "@/lib/queries";
import { formatDate } from "@/lib/ereminder";
import {
  DOC_TYPES,
  MAX_DOCUMENT_BYTES,
  createExpiryReminder,
  daysUntil,
  deleteExpiryReminder,
  docTypeLabel,
  documentPaths,
  expiryTone,
  removeDocumentFiles,
  signedDocumentUrl,
  signedDocumentUrls,
  sortDocuments,
  updateExpiryReminderDate,
  uploadDocumentFiles,
  type DocType,
  type DocumentRow,
} from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Document shelf — My-Mitr" },
      {
        name: "description",
        content:
          "Keep insurance, PUC, ID and warranty documents in one private place, with automatic expiry reminders.",
      },
      { property: "og:title", content: "Document shelf — My-Mitr" },
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
    <DocumentsPinGate>
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

      {adding ? <DocumentDialog open={adding} onOpenChange={setAdding} /> : null}
    </AppShell>
    </DocumentsPinGate>
  );
}

/** Pages through all the photos stored for one document. */
function PhotoViewer({ urls, onClose }: { urls: string[]; onClose: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const url = urls[index] ?? "";

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b p-4">
          <DialogTitle>{t("photos.pageOf", { index: index + 1, total: urls.length })}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <img
            src={url}
            alt={t("photos.photoAlt", { index: index + 1 })}
            className="w-full rounded-xl"
          />
        </div>
        <DialogFooter className="shrink-0 justify-between gap-2 border-t p-4">
          <Button
            variant="outline"
            className="h-12"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden /> {t("photos.prev")}
          </Button>
          <Button
            variant="outline"
            className="h-12"
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            {t("documents.openFile")}
          </Button>
          <Button
            variant="outline"
            className="h-12"
            disabled={index >= urls.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            {t("photos.next")} <ChevronRight className="size-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentRowCard({ doc }: { doc: DocumentRow }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewerUrls, setViewerUrls] = useState<string[] | null>(null);
  const tone = expiryTone(doc.expiry_date);
  const paths = documentPaths(doc);

  const open = async () => {
    if (paths.length > 1) {
      const urls = await signedDocumentUrls(paths);
      if (!urls.length) {
        toast.error(t("documents.errOpen"));
        return;
      }
      setViewerUrls(urls);
      return;
    }
    const url = paths[0] ? await signedDocumentUrl(paths[0]) : null;
    if (!url) {
      toast.error(t("documents.errOpen"));
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const remove = async () => {
    if (!window.confirm(t("documents.confirmDelete"))) return;
    setBusy(true);
    await removeDocumentFiles(paths);
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
          {paths.length > 1 ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {t("documents.photoCount", { count: paths.length })}
            </p>
          ) : null}
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
          className="size-12"
          aria-label={t("documents.edit")}
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-5" aria-hidden />
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

      {editing ? <DocumentDialog open onOpenChange={setEditing} doc={doc} /> : null}
      {viewerUrls ? <PhotoViewer urls={viewerUrls} onClose={() => setViewerUrls(null)} /> : null}
    </section>
  );
}

/** Add a new document, or edit an existing one — same fields either way. */
function DocumentDialog({
  open,
  onOpenChange,
  doc,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc?: DocumentRow;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: members } = useFamilyMembers();
  const pdfRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(doc?.title ?? "");
  const [docType, setDocType] = useState<DocType>(doc?.doc_type ?? "insurance");
  const [memberId, setMemberId] = useState(doc?.family_member_id ?? "");
  const [expiry, setExpiry] = useState(doc?.expiry_date ?? "");
  const [notes, setNotes] = useState(doc?.notes ?? "");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const existingPaths = doc ? documentPaths(doc) : [];
  const existingIsPdf = existingPaths[0]?.endsWith(".pdf") ?? false;

  useEffect(() => {
    if (!open) return;
    setPhotos([]);
    setPdf(null);
  }, [open]);

  const pickPdf = (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.type !== "application/pdf") {
      toast.error(t("documents.errFileType"));
      return;
    }
    if (chosen.size > MAX_DOCUMENT_BYTES) {
      toast.error(t("documents.errFileBig"));
      return;
    }
    setPdf(chosen);
    setPhotos([]);
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error(t("documents.errTitle"));
      return;
    }
    const newFiles: Blob[] = pdf ? [pdf] : photos.map((p) => p.blob);
    if (!doc && newFiles.length === 0) {
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

    const uploaded = newFiles.length ? await uploadDocumentFiles(userId, newFiles) : [];
    if (uploaded === null) {
      setSaving(false);
      toast.error(t("documents.errSave"));
      return;
    }

    const familyMemberId = memberId || null;

    if (!doc) {
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
        file_path: uploaded[0] ?? "",
        file_paths: uploaded,
        expiry_date: expiry || null,
        notes: notes.trim() || null,
        reminder_id: reminderId,
      });
      setSaving(false);
      if (error) {
        await removeDocumentFiles(uploaded);
        if (reminderId) await deleteExpiryReminder(reminderId);
        toast.error(t("documents.errSave"));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success(t("documents.saved"));
      onOpenChange(false);
      return;
    }

    // Editing: a PDF replaces everything, extra photos are added to the set.
    const replaced = Boolean(pdf);
    const finalPaths = replaced ? uploaded : [...existingPaths, ...uploaded];

    let reminderId = doc.reminder_id;
    if (expiry && reminderId) {
      await updateExpiryReminderDate(reminderId, expiry);
    } else if (expiry && !reminderId) {
      reminderId = await createExpiryReminder({
        userId,
        title: title.trim(),
        docType,
        expiry,
        familyMemberId,
        notes: notes.trim() || null,
      });
    } else if (!expiry && reminderId) {
      await deleteExpiryReminder(reminderId);
      reminderId = null;
    }

    const { error } = await supabase
      .from("documents")
      .update({
        title: title.trim(),
        doc_type: docType,
        family_member_id: familyMemberId,
        expiry_date: expiry || null,
        notes: notes.trim() || null,
        file_path: finalPaths[0] ?? doc.file_path,
        file_paths: finalPaths,
        reminder_id: reminderId,
      })
      .eq("id", doc.id);
    setSaving(false);
    if (error) {
      await removeDocumentFiles(uploaded);
      toast.error(t("documents.errSave"));
      return;
    }
    if (replaced) await removeDocumentFiles(existingPaths);
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    toast.success(t("documents.updated"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b p-5">
          <DialogTitle>{doc ? t("documents.editTitle") : t("documents.addTitle")}</DialogTitle>
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
            {doc && existingPaths.length ? (
              <p className="text-muted-foreground text-sm">
                {existingIsPdf
                  ? t("documents.existingPdf")
                  : t("documents.existingPhotos", { count: existingPaths.length })}
              </p>
            ) : null}
            {!pdf ? (
              <PhotoCapture
                photos={photos}
                onChange={setPhotos}
                max={Math.max(0, MAX_PHOTOS - (doc && !existingIsPdf ? existingPaths.length : 0))}
                buttonLabel={t("documents.addPhotos")}
              />
            ) : null}
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                pickPdf(chosen);
              }}
            />
            {photos.length === 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full"
                onClick={() => pdfRef.current?.click()}
              >
                <Paperclip className="size-5" aria-hidden /> {t("documents.choosePdf")}
              </Button>
            ) : null}
            {pdf ? (
              <p className="text-muted-foreground text-sm">
                {t("documents.fileChosen", { name: pdf.name })}
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
