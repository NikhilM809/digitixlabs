"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Upload,
  Trash2,
  Loader2,
  Download,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canManageEmployeeDocuments } from "@/lib/permissions";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
} from "@/lib/employee-documents";
import type { EmployeeDocumentCategory } from "@prisma/client";

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

interface EmployeeDocument {
  id: string;
  title: string;
  category: EmployeeDocumentCategory;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  user: EmployeeOption & { department: { name: string } | null };
  uploadedBy: { firstName: string; lastName: string };
}

export default function EmployeeDocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = session?.user?.role;
  const canManage = role ? canManageEmployeeDocuments(role) : false;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EmployeeDocumentCategory>("OTHER");
  const [file, setFile] = useState<File | null>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-documents"],
    queryFn: () => apiFetchArray<EmployeeOption>("/api/employees"),
    enabled: status === "authenticated" && canManage,
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["employee-documents", selectedEmployeeId],
    queryFn: () =>
      apiFetchArray<EmployeeDocument>(
        `/api/employee-documents?userId=${selectedEmployeeId}`
      ),
    enabled: !!selectedEmployeeId && canManage,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !selectedEmployeeId) throw new Error("Select employee and file");
      const formData = new FormData();
      formData.append("userId", selectedEmployeeId);
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("file", file);

      const res = await fetch("/api/employee-documents", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }
      return json.data;
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setTitle("");
      setCategory("OTHER");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/employee-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Document removed");
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          Employee document management is for Admin and HR only.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderOpen className="h-7 w-7 text-brand-600" />
          Employee Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload appraisal letters, laptop undertakings, and other employee documents
        </p>
      </div>

      <Card glass>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Employee</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Upload Document</CardTitle>
          <CardDescription>
            PDF, Word, or image files up to 10MB
            {selectedEmployee
              ? ` for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Annual Appraisal"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as EmployeeDocumentCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={
              uploadMutation.isPending ||
              !selectedEmployeeId ||
              !title.trim() ||
              !file
            }
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload Document
          </Button>
        </CardContent>
      </Card>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Uploaded Documents</CardTitle>
          <CardDescription>
            {selectedEmployee
              ? `Documents for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`
              : "Select an employee"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : documents.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No documents uploaded for this employee yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Title</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">File</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Uploaded</th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-3 font-medium">{doc.title}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline">
                          {DOCUMENT_CATEGORY_LABELS[doc.category]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {doc.fileName}
                        <span className="block text-xs">{formatFileSize(doc.fileSize)}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {format(new Date(doc.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Remove "${doc.title}"?`)) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
