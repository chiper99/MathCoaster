# Code Analysis Report: MathCoaster Frontend & Backend

**Date:** 2026-02-20  
**Scope:** Full analysis of front-end and back-end codebases

---

## Executive Summary

| Category              | Count | Severity |
|-----------------------|-------|----------|
| Bugs / runtime errors  | 6     | Medium   |
| API / contract issues | 4     | Medium   |
| Code duplication      | 3     | Low      |
| Redundant logic       | 2     | Low      |
| Dead code             | 2     | Low      |
| Security notes        | 3     | Low      |

---

## 1. Bugs and Runtime Errors

### 1.1 API client ignores HTTP errors

**File:** [front-end/src/api/client.ts](front-end/src/api/client.ts) (lines 9–21)

`apiGet` and `apiPost` never check `res.ok`. On 4xx/5xx, `res.json()` is called regardless. Error payloads may be parsed and returned as if successful; non-JSON error bodies cause parse failures.

```typescript
// Current: no status check
return fetch(...).then((res) => res.json())
```

**Fix:** Check `res.ok` before parsing; throw or reject with error info on failure.

---

### 1.2 submitScore error handling

**File:** [front-end/src/api/leaderboard.ts](front-end/src/api/leaderboard.ts) (lines 26–36)

`submitScore` does not catch errors. Failed API calls (400, 500, network) result in unhandled promise rejection.

---

### 1.3 FinishModal: loading never reset on submit error

**File:** [front-end/src/components/FinishModal.tsx](front-end/src/components/FinishModal.tsx) (lines 49–57)

```typescript
const handleSubmit = async () => {
  if (!playerName.trim()) return
  setLoading(true)
  await submitScore(...)  // If this throws, setLoading(false) is never called
  const updated = await getLeaderboard(...)
  setEntries(updated)
  setSubmitted(true)
  setLoading(false)
}
```

**Fix:** Wrap in try/catch and call `setLoading(false)` in finally; show error message on failure.

---

### 1.4 Silent return when rail not ready (GameCanvas)

**File:** [front-end/src/components/GameCanvas.tsx](front-end/src/components/GameCanvas.tsx) (line 146)

`buildAndRun` returns early if `!railBodyRef.current` with no user feedback. Rapid expression changes + Run click can hit this case.

**Fix:** Show a brief toast or message when rail is not ready.

---

### 1.5 Unstable React keys

**Files:**  
- [front-end/src/pages/MenuPage.tsx](front-end/src/pages/MenuPage.tsx) (line 93)  
- [front-end/src/components/FinishModal.tsx](front-end/src/components/FinishModal.tsx) (line 84)

Keys use `key={\`${e.playerName}-${e.createdAt}-${i}\`}`. Same name + timestamp can cause key collisions. Backend returns `id`; it should be used for stable keys.

**Fix:** Use `e.id ?? \`${e.playerName}-${e.createdAt}-${i}\`` (after adding `id` to frontend interface).

---

### 1.6 Backend: NullReferenceException on null request body

**File:** [back-end/MathCoasterApi/MathCoasterApi/Controllers/LeaderboardController.cs](back-end/MathCoasterApi/MathCoasterApi/Controllers/LeaderboardController.cs) (lines 25–27)

```csharp
public async Task<ActionResult<LeaderboardEntry>> SubmitScore([FromBody] SubmitScoreRequest request)
{
    if (string.IsNullOrWhiteSpace(request.PlayerName))  // NRE if request is null
```

**Fix:** Add `if (request == null) return BadRequest("Request body is required");` before using `request`.

---

## 2. API and Contract Inconsistencies

### 2.1 LeaderboardEntry missing `id`

**File:** [front-end/src/api/leaderboard.ts](front-end/src/api/leaderboard.ts) (lines 7–11)

Backend returns `id` and `levelId` in camelCase. Frontend interface does not include them; `id` should be added for stable React keys.

### 2.2 No handling of error responses

Frontend does not distinguish success from error responses. Validation errors (400) and server errors (500) are not surfaced to the user.

### 2.3 Backend: no LevelId validation

**File:** [back-end/MathCoasterApi/MathCoasterApi/Controllers/LeaderboardController.cs](back-end/MathCoasterApi/MathCoasterApi/Controllers/LeaderboardController.cs)

`LevelId` is not validated. Negative, zero, and very large IDs are accepted. Frontend uses levels 1–9; backend could restrict to a valid range.

### 2.4 Backend: no PlayerName length limit

Frontend uses `maxLength={32}` in `FinishModal`. Backend has no corresponding validation; long strings can be stored.

---

## 3. Code Duplication

### 3.1 formatTime / formatTimer (3 implementations)

| File        | Function     | Lines    |
|-------------|--------------|----------|
| MenuPage.tsx    | formatTime   | 5–13  |
| FinishModal.tsx | formatTime   | 9–17  |
| GameCanvas.tsx  | formatTimer  | 471–479 |

All format milliseconds as `MM:SS.mmm`. Should be extracted to a shared utility (e.g. `utils/formatTime.ts`).

### 3.2 Duplicate index.css imports

- [front-end/src/main.tsx](front-end/src/main.tsx) (line 4)  
- [front-end/src/App.tsx](front-end/src/App.tsx) (line 5)

`index.css` is imported in both; one is redundant.

---

## 4. Redundant Logic

### 4.1 Redundant Math.floor in FinishModal

**File:** [front-end/src/components/FinishModal.tsx](front-end/src/components/FinishModal.tsx) (line 13)

```typescript
const frac = Math.floor((ms % 1000) / 1)  // / 1 is redundant; floor of 0–999 is same as value
```

**Fix:** Use `ms % 1000` (as in MenuPage and GameCanvas).

### 4.2 getLeaderboard hides all errors

**File:** [front-end/src/api/leaderboard.ts](front-end/src/api/leaderboard.ts)

`getLeaderboard` catches all errors and returns `[]`. Failures (network, 500) are invisible to the user. Consider at least logging or optional error callback.

---

## 5. Dead Code

### 5.1 onSimulationStart (GameCanvas)

**File:** [front-end/src/components/GameCanvas.tsx](front-end/src/components/GameCanvas.tsx)

`onSimulationStart` is in the props interface and dependency arrays, but `GamePage` never passes it. Effectively unused.

### 5.2 WeatherForecastController and WeatherForecast

**Files:**  
- [back-end/MathCoasterApi/MathCoasterApi/Controllers/WeatherForecastController.cs](back-end/MathCoasterApi/MathCoasterApi/Controllers/WeatherForecastController.cs)  
- [back-end/MathCoasterApi/MathCoasterApi/WeatherForecast.cs](back-end/MathCoasterApi/MathCoasterApi/WeatherForecast.cs)

Template code; not used by the frontend. Can be removed.

---

## 6. Security Notes

### 6.1 CORS

**File:** [back-end/MathCoasterApi/MathCoasterApi/Program.cs](back-end/MathCoasterApi/MathCoasterApi/Program.cs)

Only `http://localhost:5173` and `http://localhost:5000` are allowed. In Docker with nginx, frontend is same-origin, so CORS is bypassed. For other setups, origins may need to be updated.

### 6.2 AllowedHosts

`appsettings.json` has `"AllowedHosts":"*"`. For production, consider restricting to known hosts.

### 6.3 Expression parsing

Uses mathjs `compile`/`evaluate`; not arbitrary JS execution. Safe for intended math expressions.

---

## 7. Recommended Fixes (Priority Order)

1. **High:** Add null check for `request` in `SubmitScore` controller action  
2. **High:** In API client, check `res.ok` before `res.json()`; handle errors consistently  
3. **High:** Add try/catch and `setLoading(false)` in FinishModal `handleSubmit`  
4. **Medium:** Add `id` to `LeaderboardEntry` and use it for React keys  
5. **Medium:** Validate `LevelId` and `PlayerName` length on backend (e.g. data annotations)  
6. **Low:** Extract `formatTime` to shared utility  
7. **Low:** Remove duplicate `index.css` import from `App.tsx`  
8. **Low:** Simplify `frac` in FinishModal `formatTime`  
9. **Optional:** Remove `WeatherForecastController` and `WeatherForecast`  
10. **Optional:** Remove or document `onSimulationStart` in GameCanvas
