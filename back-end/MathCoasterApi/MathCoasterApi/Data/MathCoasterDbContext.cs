using Microsoft.EntityFrameworkCore;
using MathCoasterApi.Models;

namespace MathCoasterApi.Data;

public class MathCoasterDbContext : DbContext
{
    public MathCoasterDbContext(DbContextOptions<MathCoasterDbContext> options)
        : base(options)
    {
    }

    public DbSet<LeaderboardEntry> LeaderboardEntries => Set<LeaderboardEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LeaderboardEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.LevelId);
        });
    }
}
