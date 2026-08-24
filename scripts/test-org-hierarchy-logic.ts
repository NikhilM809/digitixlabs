/**
 * Pure logic tests for org hierarchy (no database required).
 * Run: npx tsx scripts/test-org-hierarchy-logic.ts
 */
import {
  buildOrgTree,
  filterOrgTree,
  restrictToTopLevelSubtree,
  type OrgEmployee,
} from "../src/lib/org-hierarchy";
import { getAdministrativePlaceholderNodeId } from "../src/lib/org-administrative-position";

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
    administrativePositionId: null,
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
    administrativePositionId: null,
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
    administrativePositionId: null,
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
    status: "LEFT",
    managerId: "mgr",
    administrativePositionId: null,
    avatar: null,
    department: null,
    designation: null,
  },
];

const activeOnly = employees.filter((e) => e.status === "ACTIVE");

const tree = buildOrgTree(activeOnly);
assert(tree.length === 1, "single root node");
assert(tree[0].id === "ceo", "CEO is root");
assert(tree[0].children.length === 1, "CEO has one direct child");
assert(tree[0].children[0].children.length === 1, "manager has one active direct report");

const activeTree = buildOrgTree(activeOnly, { activeDirectReportsOnly: true });
assert(
  activeTree[0].children[0].directReportCount === 1,
  "inactive excluded from active DR count"
);

const topLevelTree = buildOrgTree(activeOnly, { topLevelEmployeeId: "ceo" });
assert(topLevelTree.length === 1, "top-level config yields one root");
assert(topLevelTree[0].id === "ceo", "top-level employee is root");

const subtree = restrictToTopLevelSubtree(activeOnly, "mgr");
assert(subtree.length === 2, "manager subtree contains manager and report");
assert(subtree.every((e) => e.id === "mgr" || e.managerId === "mgr"), "subtree members belong under manager");

const placeholderId = "position-dr";
const withAssignee = activeOnly.map((e) =>
  e.id === "emp" ? { ...e, administrativePositionId: placeholderId } : e
);
const adminTree = buildOrgTree(withAssignee, {
  topLevelEmployeeId: "ceo",
  includeAdministrativePlaceholder: true,
  administrativePosition: {
    id: placeholderId,
    code: "DR",
    name: "DR (Administrative Placeholder)",
  },
});
const placeholderNode = adminTree[0].children.find((c) => c.isAdministrativePlaceholder);
assert(!!placeholderNode, "admin tree includes placeholder node");
assert(
  placeholderNode!.id === getAdministrativePlaceholderNodeId(placeholderId),
  "placeholder node uses stable id"
);
assert(placeholderNode!.children.length === 1, "placeholder contains assigned employee");

const publicTree = buildOrgTree(withAssignee, {
  topLevelEmployeeId: "ceo",
  includeAdministrativePlaceholder: false,
});
assert(
  !JSON.stringify(publicTree).includes(getAdministrativePlaceholderNodeId(placeholderId)),
  "non-admin tree excludes placeholder"
);

const filtered = filterOrgTree(tree, "carol");
assert(filtered.length === 1, "search finds Carol through tree path");

console.log("\nAll org hierarchy logic tests passed.");
