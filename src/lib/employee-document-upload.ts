import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export async function saveEmployeeDocumentFile(userId: string, file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Please upload a PDF, Word document, or image (JPG/PNG/WebP)");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("File must be 10MB or smaller");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = EXT_BY_TYPE[file.type] ?? (path.extname(file.name) || ".bin");
  const safeName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
  const filename = `${randomUUID()}-${safeName}${ext}`;
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "employee-documents",
    userId
  );
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return {
    fileUrl: `/uploads/employee-documents/${userId}/${filename}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}