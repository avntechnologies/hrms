namespace Hrms.Application;

public static class Permissions
{
    public const string All = "*";
    public const string PlatformManage = "platform.manage";
    public const string DashboardAdmin = "dashboard.admin";
    public const string EmployeesRead = "employees.read";
    public const string EmployeesManage = "employees.manage";
    public const string OrganizationManage = "organization.manage";
    public const string LeaveManage = "leave.manage";
    public const string AttendanceManage = "attendance.manage";
    public const string WorkforceManage = "workforce.manage";
    public const string PayrollManage = "payroll.manage";
    public const string RecruitmentManage = "recruitment.manage";
    public const string PerformanceManage = "performance.manage";
    public const string AssetsManage = "assets.manage";
    public const string ExpensesManage = "expenses.manage";
    public const string TrainingManage = "training.manage";
    public const string IdentityManage = "identity.manage";
    public const string AuditRead = "audit.read";
    public const string SelfService = "self.service";
    public const string TeamRead = "team.read";
    public const string TeamApprove = "team.approve";

    public static readonly IReadOnlyList<string> Catalog =
    [
        PlatformManage, DashboardAdmin, EmployeesRead, EmployeesManage, OrganizationManage,
        LeaveManage, AttendanceManage, WorkforceManage, PayrollManage, RecruitmentManage,
        PerformanceManage, AssetsManage, ExpensesManage, TrainingManage, IdentityManage,
        AuditRead, SelfService, TeamRead, TeamApprove
    ];

    public static readonly string[] HrAdministrator =
    [DashboardAdmin, EmployeesRead, EmployeesManage, OrganizationManage, LeaveManage, AttendanceManage,
     WorkforceManage, RecruitmentManage, PerformanceManage, AssetsManage, ExpensesManage, TrainingManage,
     IdentityManage, AuditRead];

    public static readonly string[] PayrollAdministrator = [DashboardAdmin, EmployeesRead, PayrollManage, AuditRead];
    public static readonly string[] Manager = [SelfService, TeamRead, TeamApprove];
    public static readonly string[] Employee = [SelfService];

    public static readonly IReadOnlyList<(string Name, string NormalizedName, string[] Permissions)> TenantSystemRoles =
    [
        ("HR Administrator", "HR_ADMINISTRATOR", HrAdministrator),
        ("Payroll Administrator", "PAYROLL_ADMINISTRATOR", PayrollAdministrator),
        ("People Manager", "PEOPLE_MANAGER", Manager),
        ("Employee Self-Service", "EMPLOYEE_SELF_SERVICE", Employee)
    ];
}
