using MathCoasterApi.Models;

namespace MathCoasterApi.Services;

public interface ILeaderboardService
{
    Task<IEnumerable<LeaderboardEntry>> GetTopEntriesAsync(int levelId, int top = 10);
    Task<LeaderboardEntry> SubmitScoreAsync(int levelId, string playerName, long timeMs);
}
