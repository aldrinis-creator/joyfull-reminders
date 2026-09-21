import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Play, Trash2, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import { useProfile } from "@/lib/queries";
import { normalizeTone, signedAlarmUrl } from "@/hooks/useAlarmSettings";
import {
  BUILT_IN_TONES,
  getAudioDiagnostics,
  playAlarm,
  preloadCustomAlarm,
  setAlarmSettings,
  unlockAudio,
  type AlarmToneId,
} from "@/lib/alarm-sound";

const MAX_BYTES = 2 * 1024 * 1024;

export function AlarmSoundCard({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tone, setTone] = useState<AlarmToneId>("siren");
  const [volume, setVolume] = useState(1);
  const [customPath, setCustomPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setTone(normalizeTone(profile.alarm_sound));
    setVolume(Number(profile.alarm_volume ?? 1));
    setCustomPath(profile.alarm_sound_path ?? null);
  }, [profile]);

  const persist = async (patch: {
    alarm_sound?: string;
    alarm_volume?: number;
    alarm_sound_path?: string | null;
  }) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      toast.error(t("profile.errSave"));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const preview = async (id: AlarmToneId, level = volume) => {
    const unlocked = await unlockAudio();
    const played = playAlarm({ tone: id, volume: level });
    setDiag(getAudioDiagnostics());
    if (!unlocked || !played) {
      toast.error(t("profile.alarmBlocked"), {
        action: { label: t("retry"), onClick: () => void preview(id, level) },
      });
    }
  };

  const chooseTone = (id: AlarmToneId) => {
    setTone(id);
    setAlarmSettings({ tone: id });
    void preview(id);
    void persist({ alarm_sound: id });
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error(t("profile.alarmFileType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("profile.alarmFileBig"));
      return;
    }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setBusy(false);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
    const path = `${userId}/alarm-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("alarm-sounds")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      setBusy(false);
      toast.error(t("profile.alarmUploadFailed"));
      return;
    }
    if (customPath) await supabase.storage.from("alarm-sounds").remove([customPath]);
    const url = await signedAlarmUrl(path);
    const decoded = await preloadCustomAlarm(url);
    setBusy(false);
    if (!decoded) {
      await supabase.storage.from("alarm-sounds").remove([path]);
      toast.error(t("profile.alarmFileType"));
      return;
    }
    setCustomPath(path);
    setTone("custom");
    setAlarmSettings({ tone: "custom" });
    await persist({ alarm_sound: "custom", alarm_sound_path: path });
    toast.success(t("profile.alarmUploaded"));
    void preview("custom");
  };

  const removeCustom = async () => {
    if (!customPath) return;
    setBusy(true);
    await supabase.storage.from("alarm-sounds").remove([customPath]);
    setCustomPath(null);
    void preloadCustomAlarm(null);
    const nextTone: AlarmToneId = tone === "custom" ? "siren" : tone;
    setTone(nextTone);
    setAlarmSettings({ tone: nextTone });
    await persist({ alarm_sound: nextTone, alarm_sound_path: null });
    setBusy(false);
  };

  const toneLabel = (id: AlarmToneId) => t(`profile.tone_${id}`);

  return (
    <section className={embedded ? "space-y-4" : "bg-card shadow-card space-y-4 rounded-3xl p-5"}>
      <div>
        <h2 className="flex items-center gap-2 text-xl">
          <BellRing className="size-5" aria-hidden /> {t("profile.alarmTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("profile.alarmHint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("profile.alarmTitle")}>
        {BUILT_IN_TONES.map((id) => (
          <div key={id} className="flex gap-2">
            <Button
              type="button"
              variant={tone === id ? "default" : "outline"}
              aria-pressed={tone === id}
              className="h-12 flex-1 justify-start"
              onClick={() => chooseTone(id)}
            >
              {toneLabel(id)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-12 shrink-0"
              aria-label={t("profile.alarmPreview", { name: toneLabel(id) })}
              onClick={() => void preview(id)}
            >
              <Play className="size-5" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        <Label htmlFor="alarm-volume">{t("profile.alarmVolume")}</Label>
        <div className="flex items-center gap-3">
          <Volume2 className="text-muted-foreground size-5 shrink-0" aria-hidden />
          <Slider
            id="alarm-volume"
            className="flex-1"
            min={0.1}
            max={1}
            step={0.05}
            value={[volume]}
            onValueChange={(v) => {
              const level = v[0] ?? 1;
              setVolume(level);
              setAlarmSettings({ volume: level });
            }}
            onValueCommit={(v) => {
              const level = v[0] ?? 1;
              void preview(tone, level);
              void persist({ alarm_volume: level });
            }}
          />
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <Button variant="outline" className="h-12 w-full" onClick={() => void preview(tone)}>
          <Play className="size-5" aria-hidden /> {t("profile.alarmTest")}
        </Button>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div>
          <p className="font-semibold">{t("profile.alarmCustom")}</p>
          <p className="text-muted-foreground text-sm">{t("profile.alarmCustomHint")}</p>
        </div>
        {customPath ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={tone === "custom" ? "default" : "outline"}
              aria-pressed={tone === "custom"}
              className="h-12 flex-1"
              onClick={() => chooseTone("custom")}
            >
              {t("profile.tone_custom")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive size-12"
              disabled={busy}
              aria-label={t("profile.alarmRemove")}
              onClick={() => void removeCustom()}
            >
              <Trash2 className="size-5" aria-hidden />
            </Button>
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          variant="outline"
          className="h-12 w-full"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-5" aria-hidden />
          {busy ? t("saving") : customPath ? t("profile.alarmReplace") : t("profile.alarmUpload")}
        </Button>
      </div>

      <p className="text-muted-foreground border-t pt-4 text-xs">{t("profile.alarmClosedNote")}</p>
    </section>
  );
}
