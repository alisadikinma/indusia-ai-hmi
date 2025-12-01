export const customers = [
  { id: "cust-A", name: "Customer A" },
  { id: "cust-B", name: "Customer B" },
  { id: "cust-C", name: "Customer C" },
];

export const sections = [
  { id: "sec-smt", name: "SMT" },
  { id: "sec-mi", name: "MI" },
  { id: "sec-testing", name: "Testing" },
  { id: "sec-fatp", name: "FATP" },
];

export const customerSections = [
  { customerId: "cust-A", sectionId: "sec-smt" },
  { customerId: "cust-A", sectionId: "sec-mi" },
  { customerId: "cust-A", sectionId: "sec-fatp" },
  { customerId: "cust-B", sectionId: "sec-smt" },
  { customerId: "cust-B", sectionId: "sec-testing" },
  { customerId: "cust-B", sectionId: "sec-fatp" },
  { customerId: "cust-C", sectionId: "sec-mi" },
  { customerId: "cust-C", sectionId: "sec-fatp" },
];

export const lines = [
  { id: "line-1", name: "Line 1", customerId: "cust-A", sectionId: "sec-smt" },
  { id: "line-2", name: "Line 2", customerId: "cust-A", sectionId: "sec-mi" },
  { id: "line-3", name: "Line 1", customerId: "cust-B", sectionId: "sec-testing" },
  { id: "line-4", name: "Line 2", customerId: "cust-B", sectionId: "sec-smt" },
  { id: "line-5", name: "Line 1", customerId: "cust-C", sectionId: "sec-fatp" },
];

export const boards = [
  { id: "board-A", name: "Board A", customerId: "cust-A" },
  { id: "board-B", name: "Board B", customerId: "cust-A" },
  { id: "board-C", name: "Board C", customerId: "cust-B" },
  { id: "board-Z", name: "Board Z", customerId: "cust-B" },
  { id: "board-Y", name: "Board Y", customerId: "cust-C" },
  { id: "board-Q", name: "Board Q", customerId: "cust-C" },
];

export const roles = [
  { id: "operator", name: "Operator", description: "Floor operators handling inspection tasks", isSystem: true },
  { id: "manager", name: "Manager", description: "QC managers reviewing override requests", isSystem: true },
  { id: "engineer", name: "Engineer", description: "Process engineers managing configurations", isSystem: true },
  { id: "superadmin", name: "Super Admin", description: "Full system access and user management", isSystem: true },
];

export const menuItems = [
  { id: "dashboard", name: "Dashboard", path: "/" },
  { id: "inspection", name: "HMI Inspection", path: "/inspection/result" },
  { id: "overrides", name: "Manager Override Queue", path: "/inspection/overrides" },
  { id: "engineering", name: "Engineering Console", path: "/engineering/master-data" },
  { id: "sync", name: "Sync to Cloud", path: "/settings/sync" },
  { id: "superadmin", name: "Super Admin Panel", path: "/super-admin" },
  { id: "help", name: "Help Overlay", path: "/help" },
];

export const permissions = {
  operator: ["dashboard", "inspection", "help"],
  manager: ["dashboard", "inspection", "overrides", "sync", "help"],
  engineer: ["dashboard", "engineering", "sync", "help"],
  superadmin: ["dashboard", "inspection", "overrides", "engineering", "sync", "superadmin", "help"],
};

export const userProfiles = [
  {
    id: "sa-1",
    name: "Super Admin",
    email: "admin@company.com",
    role: "superadmin",
    sections: ["sec-smt", "sec-mi", "sec-testing", "sec-fatp"],
    password: "SuperAdmin@123",
    whatsapp: "+6281234567890",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: true,
    },
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "mgr-A",
    name: "Manager A",
    email: "manager.a@company.com",
    role: "manager",
    sections: ["sec-smt"],
    password: "MgrA@123",
    whatsapp: "+6281234567891",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: false,
    },
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "mgr-B",
    name: "Manager B",
    email: "manager.b@company.com",
    role: "manager",
    sections: ["sec-mi"],
    password: "MgrB@123",
    whatsapp: "+6281234567892",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: false,
    },
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "mgr-C",
    name: "Manager C",
    email: "manager.c@company.com",
    role: "manager",
    sections: ["sec-testing"],
    password: "MgrC@123",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: false,
    },
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "mgr-D",
    name: "Manager D",
    email: "manager.d@company.com",
    role: "manager",
    sections: ["sec-fatp"],
    password: "MgrD@123",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: false,
    },
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "op-1",
    name: "Operator 1",
    email: "operator.1@company.com",
    role: "operator",
    sections: ["sec-smt", "sec-mi"],
    password: "Op1@123",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: false,
      whatsapp: false,
    },
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "op-2",
    name: "Operator 2",
    email: "operator.2@company.com",
    role: "operator",
    sections: ["sec-testing"],
    password: "Op2@123",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: false,
      whatsapp: false,
    },
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "eng-1",
    name: "Engineer SMT",
    email: "engineer.smt@company.com",
    role: "engineer",
    sections: ["sec-smt"],
    password: "EngSMT@123",
    whatsapp: "+6281234567893",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: true,
    },
    createdAt: "2024-01-20T00:00:00Z",
  },
  {
    id: "eng-2",
    name: "Engineer MI",
    email: "engineer.mi@company.com",
    role: "engineer",
    sections: ["sec-mi"],
    password: "EngMI@123",
    whatsapp: "+6281234567894",
    status: "active",
    mustChangePassword: false,
    notificationPreferences: {
      email: true,
      whatsapp: true,
    },
    createdAt: "2024-01-20T00:00:00Z",
  }
];
