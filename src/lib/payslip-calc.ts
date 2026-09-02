export type PayslipEarnings = {
  salary: number;
  hra?: number;
  specialAllowance?: number;
  internetAllowance?: number;
  performanceBonus?: number;
  /** @deprecated legacy payslip fields */
  bonus?: number;
  incentive?: number;
  reimbursement?: number;
};

export function normalizePayslipEarnings(components: PayslipEarnings) {
  const hasNewComponents =
    (components.hra ?? 0) +
      (components.specialAllowance ?? 0) +
      (components.internetAllowance ?? 0) +
      (components.performanceBonus ?? 0) >
    0;

  if (hasNewComponents) {
    return {
      salary: components.salary,
      hra: components.hra ?? 0,
      specialAllowance: components.specialAllowance ?? 0,
      internetAllowance: components.internetAllowance ?? 0,
      performanceBonus: components.performanceBonus ?? 0,
    };
  }

  return {
    salary: components.salary,
    hra: 0,
    specialAllowance: components.incentive ?? 0,
    internetAllowance: components.reimbursement ?? 0,
    performanceBonus: components.bonus ?? 0,
  };
}

export function calculateGrossEarnings(components: PayslipEarnings) {
  const earnings = normalizePayslipEarnings(components);
  return (
    earnings.salary +
    earnings.hra +
    earnings.specialAllowance +
    earnings.internetAllowance +
    earnings.performanceBonus
  );
}

export function calculateNetSalary(
  components: PayslipEarnings & { deductions?: number }
) {
  return calculateGrossEarnings(components) - (components.deductions ?? 0);
}
