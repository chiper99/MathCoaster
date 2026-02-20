using Microsoft.AspNetCore.Mvc;
using MathCoasterApi.Models;
using MathCoasterApi.Services;

namespace MathCoasterApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly ILeaderboardService _leaderboardService;

    public LeaderboardController(ILeaderboardService leaderboardService)
    {
        _leaderboardService = leaderboardService;
    }

    [HttpGet("{levelId:int}")]
    public async Task<ActionResult<IEnumerable<LeaderboardEntry>>> GetLeaderboard(int levelId)
    {
        if (levelId < 1 || levelId > 99)
            return BadRequest("LevelId must be between 1 and 99");

        var entries = await _leaderboardService.GetTopEntriesAsync(levelId, 10);
        return Ok(entries);
    }

    [HttpPost]
    public async Task<ActionResult<LeaderboardEntry>> SubmitScore([FromBody] SubmitScoreRequest? request)
    {
        if (request == null)
            return BadRequest("Request body is required");

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var entry = await _leaderboardService.SubmitScoreAsync(
            request.LevelId,
            request.PlayerName,
            request.TimeMs
        );
        return CreatedAtAction(
            nameof(GetLeaderboard),
            new { levelId = entry.LevelId },
            entry
        );
    }
}
