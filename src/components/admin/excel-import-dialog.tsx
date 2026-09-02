"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RowError {
  row: number;
  message: string;
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  uploadUrl: string;
  onSuccess?: () => void;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  title,
  description,
  uploadUrl,
  onSuccess,
}: ExcelImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [preview, setPreview] = useState<unknown[] | null>(null);
  const [step, setStep] = useState<"select" | "preview" | "errors">("select");

  const reset = () => {
    setFile(null);
    setErrors([]);
    setPreview(null);
    setStep("select");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const upload = async (confirm: boolean) => {
    if (!file) {
      toast.error("Please select an Excel file");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (confirm) formData.append("confirm", "true");

      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setStep("errors");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      if (!confirm && data.preview) {
        setPreview(data.preview);
        setStep("preview");
        return;
      }

      toast.success(data.message || `Updated ${data.updated ?? 0} records`);
      handleClose(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={() => upload(false)} disabled={!file || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Validate File
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Validation passed</p>
                <p className="text-muted-foreground mt-1">
                  {preview.length} row{preview.length !== 1 ? "s" : ""} ready to import.
                </p>
              </div>
            </div>
            <ul className="max-h-40 overflow-y-auto space-y-1 text-sm text-muted-foreground">
              {(preview as Array<{ employeeId?: string; action?: string; fields?: string[] }>).map(
                (row, i) => (
                  <li key={i}>
                    {row.employeeId ?? `Row ${i + 1}`}: {row.action ?? "import"}
                    {row.fields?.length ? ` — ${row.fields.join(", ")}` : ""}
                  </li>
                )
              )}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button onClick={() => upload(true)} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Import
              </Button>
            </div>
          </div>
        )}

        {step === "errors" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>Fix the errors below and upload again.</p>
            </div>
            <ul className="max-h-48 overflow-y-auto space-y-1 text-sm font-mono">
              {errors.map((e, i) => (
                <li key={i} className="text-destructive">
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button variant="outline" onClick={reset}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
