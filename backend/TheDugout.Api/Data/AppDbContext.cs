using Microsoft.EntityFrameworkCore;
using TheDugout.Api.Models;

namespace TheDugout.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Card> Cards => Set<Card>();
    public DbSet<Binder> Binders => Set<Binder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Card configuration
        modelBuilder.Entity<Card>(entity =>
        {
            entity.HasIndex(c => new { c.BinderNumber, c.PageNumber, c.Row, c.Column })
                  .IsUnique()
                  .HasDatabaseName("IX_Card_Location");

            entity.HasIndex(c => c.PlayerName);
            entity.HasIndex(c => c.Year);
            entity.HasIndex(c => c.SetName);
            entity.HasIndex(c => c.Team);

            // Full-text search vector as a generated stored column
            entity.HasGeneratedTsVectorColumn(
                c => c.SearchVector,
                "english",
                c => new { c.PlayerName, c.SetName, c.Team, c.Manufacturer, c.Notes, c.Tags })
                .HasIndex(c => c.SearchVector)
                .HasMethod("GIN");

            // Relationship to Binder
            entity.HasOne(c => c.Binder)
                  .WithMany(b => b.Cards)
                  .HasForeignKey(c => c.BinderNumber)
                  .HasPrincipalKey(b => b.Id)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // Binder configuration
        modelBuilder.Entity<Binder>(entity =>
        {
            entity.HasIndex(b => b.Name);
        });
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries<Card>()
            .Where(e => e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
    }
}
