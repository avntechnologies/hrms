export interface UserSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: {
    id: string;
    tenantId: string;
    employeeId?: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
  };
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  clockedInAt?: string;
  clockedOutAt?: string;
  status: string;
  workHours: number;
  overtimeHours: number;
  source?: string;
  clockInLatitude?: number;
  clockInLongitude?: number;
  clockInAccuracyMeters?: number;
  clockInAddress?: string;
  clockInIpAddress?: string;
  clockInUserAgent?: string;
  clockOutLatitude?: number;
  clockOutLongitude?: number;
  clockOutAccuracyMeters?: number;
  clockOutAddress?: string;
  clockOutIpAddress?: string;
  clockOutUserAgent?: string;
  version: number;
}

export interface SelfDashboard {
  profile: {
    employeeId: string;
    employeeNumber: string;
    fullName: string;
    workEmail: string;
    phone?: string;
    hireDate: string;
    status: string;
    employmentType: string;
    departmentId?: string;
    designationId?: string;
    locationId?: string;
    managerId?: string;
    salaryCurrency: string;
    baseSalary: number;
  };
  todayAttendance?: AttendanceRecord;
  pendingLeaveRequests: number;
  availableLeaveDays: number;
  pendingTimesheets: number;
  openExpenses: number;
  trainingDue: number;
  announcements: {
    id: string;
    title: string;
    body: string;
    publishedAt: string;
    expiresAt?: string;
    audience: string;
  }[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Dashboard {
  activeEmployees: number;
  pendingLeaveRequests: number;
  openJobs: number;
  availableAssets: number;
  currentPayrollTotal: number;
  employeesByStatus: Record<string, number>;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  phone?: string;
  hireDate: string;
  status: string;
  employmentType: string;
  departmentId?: string;
  designationId?: string;
  locationId?: string;
  managerId?: string;
  baseSalary: number;
  salaryCurrency: string;
  userId?: string;
  version: number;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'currency' | 'status' | 'number';
}

export interface FormFieldDefinition {
  key: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'time'
    | 'select'
    | 'multiselect'
    | 'textarea'
    | 'checkbox';
  required?: boolean;
  options?: { label: string; value: string | number | boolean }[];
  optionsEndpoint?: string;
  optionLabel?: string;
  optionValue?: string;
  optionsShape?: 'array' | 'paged';
  placeholder?: string;
  defaultValue?: string | number | boolean | string[];
  min?: number;
  help?: string;
  sourceKey?: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'date' | 'number';
  options?: { label: string; value: string }[];
  optionsEndpoint?: string;
  optionLabel?: string;
  optionValue?: string;
  optionsShape?: 'array' | 'paged';
}

export interface RowActionDefinition {
  label: string;
  icon: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  fields?: FormFieldDefinition[];
  confirm?: string;
  tone?: 'default' | 'danger';
  detailColumns?: ColumnDefinition[];
  detailTitle?: string;
  visibleStatuses?: string[];
}

export interface WorkspaceViewDefinition {
  label: string;
  icon?: string;
  endpoint: string;
  listShape?: 'paged' | 'array';
  columns: ColumnDefinition[];
  createEndpoint?: string;
  createLabel?: string;
  fields?: FormFieldDefinition[];
  filters?: FilterDefinition[];
  rowActions?: RowActionDefinition[];
  toolbarActions?: RowActionDefinition[];
  emptyMessage?: string;
}

export interface ModuleDefinition {
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  endpoint?: string;
  listShape?: 'paged' | 'array';
  columns?: ColumnDefinition[];
  createEndpoint?: string;
  createLabel?: string;
  fields?: FormFieldDefinition[];
  views: WorkspaceViewDefinition[];
  highlights: {
    label: string;
    value: string;
    trend: string;
    tone: 'blue' | 'green' | 'amber' | 'violet';
  }[];
}
