import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeDocumentUploadSchema } from "@/lib/validations";
import {
  canManageEmployeeDocuments,
  canViewOwnDocuments,
} from "@/lib/permissions";
import { saveEmployeeDocumentFile } from "@/lib/employee-document-upload";

const documentInclude = {
  user: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
    },
  },
  uploadedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canViewOwnDocuments(user.role)) {
    return apiError("Forbidden", 403);
  }

  const userId = request.nextUrl.searchParams.get("userId");

  if (canManageEmployeeDocuments(user.role)) {
    const where: { userId?: string; isActive: boolean } = { isActive: true };
    if (userId) where.userId = userId;

    const documents = await prisma.employeeDocument.findMany({
      where,
      include: documentInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    return apiSuccess(documents);
  }

  if (userId && userId !== user.id) {
    return apiError("Forbidden", 403);
  }

  const documents = await prisma.employeeDocument.findMany({
    where: { userId: user.id, isActive: true },
    include: documentInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  return apiSuccess(documents);
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error || !user) return error;

  if (!canManageEmployeeDocuments(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const parsed = employeeDocumentUploadSchema.safeParse({
      userId: formData.get("userId"),
      title: formData.get("title"),
      category: formData.get("category"),
    });

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    if (!(file instanceof File)) {
      return apiError("Document file is required", 400);
    }

    const employee = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    const saved = await saveEmployeeDocumentFile(parsed.data.userId, file);

    const document = await prisma.employeeDocument.create({
      data: {
        userId: parsed.data.userId,
        title: parsed.data.title,
        category: parsed.data.category,
        fileName: saved.fileName,
        fileUrl: saved.fileUrl,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        uploadedById: user.id,
      },
      include: documentInclude,
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "EmployeeDocument",
      entityId: document.id,
      details: `Uploaded "${document.title}" for ${employee.firstName} ${employee.lastName}`,
    });

    await prisma.notification.create({
      data: {
        userId: parsed.data.userId,
        type: "GENERAL",
        title: "New document uploaded",
        message: `${document.title} has been uploaded to your employee documents.`,
        link: "/my-documents",
      },
    });

    return apiSuccess(document, 201);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload document";
    return apiError(message, 400);
  }
}
