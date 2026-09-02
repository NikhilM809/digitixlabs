/** Leave types removed from the application — kept in DB for historical records only */
export const DEPRECATED_LEAVE_TYPE_CODES = ["WFH", "HD", "ML", "PL"] as const;

export const PARENTAL_LEAVE_CODE = "PRL" as const;

export function isDeprecatedLeaveTypeCode(code: string) {
  return DEPRECATED_LEAVE_TYPE_CODES.includes(
    code as (typeof DEPRECATED_LEAVE_TYPE_CODES)[number]
  );
}
