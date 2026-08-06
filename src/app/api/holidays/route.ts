import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";

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
