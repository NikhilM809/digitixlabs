import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import { holidaySchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const where: {
      isActive?: boolean;
      date?: { gte: Date; lte: Date };
    } = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        where.date = {
          gte: new Date(`${yearNum}-01-01`),
          lte: new Date(`${yearNum}-12-31`),
        };
      }
    }

    const holidays = await prisma.holidayCalendar.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return apiSuccess(holidays);
  } catch (err) {
    console.error("Holidays GET error:", err);
    return apiError("Internal server error", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "HR"]);
    if (error) return error;

    const body = await request.json();
    const parsed = holidaySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const holidayDate = new Date(parsed.data.date);
    const duplicate = await prisma.holidayCalendar.findFirst({
      where: {
        name: parsed.data.name,
        date: holidayDate,
        isActive: true,
      },
    });
    if (duplicate) {
      return apiError("A holiday with this name and date already exists", 409);
    }

    const holiday = await prisma.holidayCalendar.create({
      data: {
        name: parsed.data.name,
        date: new Date(parsed.data.date),
        description: parsed.data.description,
        isRegional: parsed.data.isRegional,
        region: parsed.data.region,
      },
    });

    const allUsers = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    await Promise.all(
      allUsers.map((u) =>
        createNotification({
          userId: u.id,
          type: "HOLIDAY_ANNOUNCEMENT",
          title: "New Holiday Added",
          message: `${holiday.name} on ${new Date(holiday.date).toLocaleDateString("en-IN")}`,
          link: "/holidays",
        })
      )
    );

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "Holiday",
      entityId: holiday.id,
    });

    return apiSuccess(holiday, 201);
  } catch (err) {
    console.error("Holidays POST error:", err);
    return apiError("Failed to create holiday", 500);
  }
}
