"use client";

import { UploadButton } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

export function LeaveAttachmentField({
  value,
  onChange,
  optional = true,
}: {
  value?: string;
  onChange: (url: string) => void;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="attachment">
        Supporting Document {optional ? "(optional)" : ""}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id="attachment"
          type="url"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a document link or upload a file below"
        />
        <UploadButton
          endpoint="leaveAttachment"
          onClientUploadComplete={(res) => {
            const url = res[0]?.url;
            if (url) {
              onChange(url);
              toast.success("Document uploaded");
            }
          }}
          onUploadError={(error) => {
            toast.error(error.message);
          }}
          content={{
            button({ ready, isUploading }) {
              return (
                <Button type="button" variant="outline" disabled={!ready || isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4" />
                      Upload file
                    </>
                  )}
                </Button>
              );
            },
          }}
        />
        {value ? (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")}>
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Optional for sick leave and other types. PDF or image up to 4MB.
      </p>
    </div>
  );
}
