export function calculateGrossEarnings(components: {
  salary: number;
  bonus?: number;
  incentive?: number;
  reimbursement?: number;
}) {
  return (
    components.salary +
    (components.bonus ?? 0) +
    (components.incentive ?? 0) +
    (components.reimbursement ?? 0)
  );
}

export function calculateNetSalary(components: {
  salary: number;
  bonus?: number;
  incentive?: number;
  reimbursement?: number;
  deductions?: number;
}) {
  return calculateGrossEarnings(components) - (components.deductions ?? 0);
}
