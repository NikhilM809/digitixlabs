/**
 * Pure logic tests for org hierarchy (no database required).
 * Run: npx tsx scripts/test-org-hierarchy-logic.ts
 */
import {
  buildOrgTree,
  filterOrgTree,
  type OrgEmployee,
} from "../src/lib/org-hierarchy";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

const employees: OrgEmployee[] = [
  {
    id: "ceo",
    employeeId: "E001",
    firstName: "Alice",
    lastName: "CEO",
    role: "ADMIN",
    status: "ACTIVE",
    managerId: null,
    avatar: null,
    department: null,
    designation: null,
  },
  {
    id: "mgr",
    employeeId: "E002",
    firstName: "Bob",
    lastName: "Manager",
    role: "MANAGER",
    status: "ACTIVE",
    managerId: "ceo",
    avatar: null,
    department: null,
    designation: null,
  },
  {
    id: "emp",
    employeeId: "E003",
    firstName: "Carol",
    lastName: "Employee",
    role: "EMPLOYEE",
    status: "ACTIVE",
    managerId: "mgr",
    avatar: null,
    department: null,
    designation: null,
  },
  {
    id: "inactive",
    employeeId: "E004",
    firstName: "Dan",
    lastName: "Inactive",
    role: "EMPLOYEE",
    status: "INACTIVE",
    managerId: "mgr",
    avatar: null,
    department: null,
    designation: null,
  },
];

const tree = buildOrgTree(employees);
assert(tree.length === 1, "single root node");
assert(tree[0].id === "ceo", "CEO is root");
assert(tree[0].children.length === 1, "CEO has one direct child");
assert(tree[0].children[0].children.length === 2, "manager has two direct reports in full tree");

const activeTree = buildOrgTree(employees, { activeDirectReportsOnly: true });
assert(
  activeTree[0].children[0].directReportCount === 1,
  "inactive excluded from active DR count"
);

const filtered = filterOrgTree(tree, "carol");
assert(filtered.length === 1, "search finds Carol through tree path");

const selfLoop = employees.map((e) =>
  e.id === "emp" ? { ...e, managerId: "emp" } : e
);
// buildOrgTree should still work; cycle prevention is in assignEmployeeManager
buildOrgTree(selfLoop);

console.log("\nAll org hierarchy logic tests passed.");
