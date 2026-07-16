using Hrms.Domain;
using Hrms.Infrastructure.Identity;
using Hrms.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Tests;

public sealed class TenantIsolationTests
{
    [Fact]
    public async Task Global_filter_only_returns_current_tenant_rows()
    {
        var tenant = new CurrentTenant();
        var first = Guid.NewGuid(); var second = Guid.NewGuid();
        tenant.Set(first);
        await using var db = CreateDb(tenant);
        db.Employees.AddRange(Employee(first, "A-1"), Employee(second, "B-1"));
        await db.SaveChangesAsync();

        var firstRows = await db.Employees.ToListAsync();
        Assert.Single(firstRows); Assert.Equal(first, firstRows[0].TenantId);

        tenant.Set(second);
        var secondRows = await db.Employees.ToListAsync();
        Assert.Single(secondRows); Assert.Equal(second, secondRows[0].TenantId);
    }

    [Fact]
    public async Task Delete_is_converted_to_soft_delete()
    {
        var tenant = new CurrentTenant(); tenant.Set(Guid.NewGuid());
        await using var db = CreateDb(tenant);
        var employee = Employee(tenant.TenantId!.Value, "SOFT-1");
        db.Employees.Add(employee); await db.SaveChangesAsync();
        db.Employees.Remove(employee); await db.SaveChangesAsync();

        Assert.Empty(await db.Employees.ToListAsync());
        var deleted = await db.Employees.IgnoreQueryFilters().SingleAsync(x => x.Id == employee.Id);
        Assert.True(deleted.IsDeleted); Assert.NotNull(deleted.DeletedAt);
    }

    private static HrmsDbContext CreateDb(CurrentTenant tenant)
    {
        var options = new DbContextOptionsBuilder<HrmsDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new HrmsDbContext(options, tenant, new TestCurrentUser());
    }
    private static Employee Employee(Guid tenantId, string number) => new()
    {
        TenantId = tenantId, EmployeeNumber = number, FirstName = "Test", LastName = "Employee",
        WorkEmail = $"{number.ToLowerInvariant()}@example.test", HireDate = DateOnly.FromDateTime(DateTime.UtcNow)
    };
}
