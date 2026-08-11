"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

interface ProfileAvatarUploadProps {
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  uploadUrl: string;
  size?: "md" | "lg";
  onUploaded?: (avatarUrl: string) => void;
}

export function ProfileAvatarUpload({
  avatarUrl,
  firstName,
  lastName,
  uploadUrl,
  size = "lg",
  onUploaded,
}: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const avatarSize = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  const displayUrl = preview ?? avatarUrl ?? undefined;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      toast.success("Profile picture updated");
      onUploaded?.(json.data.avatar);
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className={avatarSize}>
          <AvatarImage src={displayUrl} alt={`${firstName} ${lastName}`} />
          <AvatarFallback className={size === "lg" ? "text-xl" : "text-base"}>
            {getInitials(firstName, lastName)}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {uploading ? "Uploading..." : "Change photo"}
      </Button>
    </div>
  );
}
