import { useState, useRef } from "react";
import { Mic, Square, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AudioRecorder({
  onUpload,
  onRemove
}: {
  onUpload: (path: string) => void;
  onRemove: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(audioBlob));
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone access denied or unavailable.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    setIsUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      const fileName = `${userData.user.id}/${Date.now()}.webm`;
      
      const { error } = await supabase.storage
        .from("reminder_audio")
        .upload(fileName, blob, { contentType: "audio/webm" });

      if (error) throw error;
      
      onUpload(fileName);
    } catch (err) {
      toast.error("Failed to upload audio message.");
      setAudioUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    setAudioUrl(null);
    onRemove();
  };


  if (audioUrl) {
    return (
      <div className="bg-card shadow-card rounded-3xl p-5 mt-4 space-y-3 border">
        <p irclassName="font-semibold text-sm">Personal Voice Message</p>
        <div className="flex items-center gap-3">
          <audio src={audioUrl} controls className="w-full h-10" />
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive shrink-0">
            <Trash2 className="size-5" />
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-card shadow-card rounded-3xl p-5 mt-4 border">
      <div className="flex items-center justify-between">
        <div>
          <p irclassName="font-semibold text-sm">Record a Voice Message</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Add a personal touch to this reminder.</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant={isRecording ? "destructive" : "secondary"}
          className={`h-12 w-12 shrink-0 rounded-full ${isRecording ? "animate-pulse" : ""}`}
          disabled={isUploading}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isUploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isRecording ? (
            <Square className="size-5" />
          ) : (
            <Mic className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}

