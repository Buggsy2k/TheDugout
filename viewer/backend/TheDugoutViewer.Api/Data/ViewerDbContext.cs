using Microsoft.EntityFrameworkCore;
using TheDugoutViewer.Api.Models;

namespace TheDugoutViewer.Api.Data;

public class ViewerDbContext : DbContext
{
    public ViewerDbContext(DbContextOptions<ViewerDbContext> options) : base(options) { }

    public DbSet<Card> Cards => Set<Card>();
    public DbSet<Binder> Binders => Set<Binder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Card>(entity =>
        {
            entity.HasIndex(c => new { c.BinderNumber, c.PageNumber, c.Row, c.Column })
                  .IsUnique()
                  .HasDatabaseName("IX_Card_Location")
                  .HasFilter("\"IsUnassigned\" = false");

            entity.HasIndex(c => c.PlayerName);
            entity.HasIndex(c => c.Year);
            entity.HasIndex(c => c.SetName);
            entity.HasIndex(c => c.Team);

            entity.HasGeneratedTsVectorColumn(
                c => c.SearchVector!,
                "english",
                c => new { c.PlayerName, c.SetName, c.Team, c.Manufacturer, c.Notes, c.Tags })
                .HasIndex(c => c.SearchVector!)
                .HasMethod("GIN");

            entity.Ignore(c => c.Binder);
        });

        modelBuilder.Entity<Binder>(entity =>
        {
            entity.HasIndex(b => b.Name);
            entity.Ignore(b => b.Cards);
        });
    }
}
