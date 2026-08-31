import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/timezone-utils";

export { DEFAULT_COMPANY_TIMEZONE } from "@/lib/timezone-utils";
export {
  getMinutesSinceMidnightInZone,
  parseScheduleTimeToMinutes,
  isLateForSchedule,
  getDateStringInZone,
  startOfDayInZone,
  attendanceDateFromString,
  formatDateTimeInZone,
  formatTimeInZone,
} from "@/lib/timezone-utils";

export async function getCompanyTimezone() {
  const settings = await prisma.companySettings.findFirst({
    select: { timezone: true },
  });
  return settings?.timezone || DEFAULT_COMPANY_TIMEZONE;
}
