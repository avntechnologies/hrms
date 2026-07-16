namespace Hrms.Domain;

public enum TenantStatus { Trial, Active, Suspended, Cancelled }
public enum EmploymentStatus { Active, Probation, NoticePeriod, Suspended, Terminated, Resigned }
public enum EmploymentType { Permanent, Contract, Intern, Consultant, PartTime }
public enum LeaveRequestStatus { Pending, Approved, Rejected, Cancelled }
public enum AttendanceStatus { Present, Absent, HalfDay, OnLeave, Holiday, Remote }
public enum PayrollRunStatus { Draft, Processing, Approved, Paid, Cancelled }
public enum JobStatus { Draft, Open, OnHold, Closed, Cancelled }
public enum CandidateStage { Applied, Screening, Interview, Offer, Hired, Rejected, Withdrawn }
public enum ReviewStatus { Draft, SelfReview, ManagerReview, Calibration, Completed }
public enum AssetStatus { Available, Assigned, Maintenance, Retired, Lost }
public enum ExpenseStatus { Draft, Submitted, Approved, Rejected, Reimbursed }
public enum EnrollmentStatus { Enrolled, InProgress, Completed, Cancelled }
public enum DocumentStatus { Pending, Verified, Rejected, Expired }
public enum WorkflowStatus { Pending, Approved, Rejected, Cancelled }

