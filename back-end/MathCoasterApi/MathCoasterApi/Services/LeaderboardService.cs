using Microsoft.EntityFrameworkCore;
using MathCoasterApi.Data;
using MathCoasterApi.Models;

namespace MathCoasterApi.Services;

public class LeaderboardService : ILeaderboardService
{
    private readonly MathCoasterDbContext _db;

    public LeaderboardService(MathCoasterDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<LeaderboardEntry>> GetTopEntriesAsync(int levelId, int top = 10)
    {
        return await _db.LeaderboardEntries
            .Where(e => e.LevelId == levelId)
            .OrderBy(e => e.TimeMs)
            .Take(top)
            .ToListAsync();
    }

    public async Task<LeaderboardEntry> SubmitScoreAsync(int levelId, string playerName, long timeMs)
    {
        var entry = new LeaderboardEntry
        {
            LevelId = levelId,
            PlayerName = playerName.Trim(),
            TimeMs = timeMs,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
        _db.LeaderboardEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry;
    }
}
