namespace MathCoasterApi.Models;

public class LeaderboardEntry
{
    public int Id { get; set; }
    public int LevelId { get; set; }
    public string PlayerName { get; set; } = "";
    public long TimeMs { get; set; }
    public long CreatedAt { get; set; }
}
