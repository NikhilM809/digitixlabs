import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, createAuditLog } from "@/lib/api-utils";
import { holidaySchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = holidaySchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message);
    }

    const holiday = await prisma.holidayCalendar.update({
      where: { id },
      data: {
        ...parsed.data,
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      },
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "Holiday",
      entityId: id,
    });

    return apiSuccess(holiday);
  } catch (err) {
    console.error("Update holiday error:", err);
    return apiError("Failed to update holiday", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.holidayCalendar.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "Holiday",
      entityId: id,
    });

    return apiSuccess({ message: "Holiday deleted" });
  } catch (err) {
    console.error("Delete holiday error:", err);
    return apiError("Failed to delete holiday", 500);
  }
}
