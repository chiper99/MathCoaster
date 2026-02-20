using System.ComponentModel.DataAnnotations;

namespace MathCoasterApi.Models;

public class SubmitScoreRequest
{
    [Range(1, 99)]
    public int LevelId { get; set; }

    [Required]
    [StringLength(32, MinimumLength = 1)]
    public string PlayerName { get; set; } = "";

    [Range(0, long.MaxValue)]
    public long TimeMs { get; set; }
}
