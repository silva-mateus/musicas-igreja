using Core.Auth.Configuration;
using Core.Auth.Services;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace MusicasIgreja.Api.Services.Auth;

/// <summary>
/// Distributed rate limiter backed by Redis. Replaces the in-memory implementation
/// in Core.Auth so that login lockouts survive process restarts and apply uniformly
/// across multiple backend instances.
///
/// Storage shape (per key):
///   {instance}rate:{key}            string (count) — INCR each attempt; EXPIREs at lockout window
///   {instance}rate:{key}:firstAt    string (UTC ticks) — set on first attempt; cleared on reset
///
/// IsRateLimited reads count vs <see cref="CoreAuthOptions.RateLimitMaxAttempts"/>.
/// On EXPIRE, both keys vanish, naturally resetting the bucket.
/// </summary>
public sealed class RedisRateLimitService : IRateLimitService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly CoreAuthOptions _options;
    private readonly string _prefix;

    public RedisRateLimitService(
        IConnectionMultiplexer redis,
        IOptions<CoreAuthOptions> options,
        IConfiguration config)
    {
        _redis = redis;
        _options = options.Value;
        _prefix = (config["Cache:InstanceName"] ?? "musicas:") + "rate:";
    }

    private IDatabase Db => _redis.GetDatabase();
    private string K(string key) => _prefix + key;

    public bool IsRateLimited(string key)
    {
        var raw = Db.StringGet(K(key));
        if (raw.IsNullOrEmpty) return false;
        if (!long.TryParse(raw, out var count)) return false;
        return count >= _options.RateLimitMaxAttempts;
    }

    public void RecordAttempt(string key)
    {
        var fullKey = K(key);
        var window = TimeSpan.FromMinutes(_options.RateLimitLockoutMinutes);
        var newCount = Db.StringIncrement(fullKey);
        // Set TTL only on first attempt; subsequent INCRs preserve original window
        // so a flood of attempts inside the window does not extend the lockout.
        if (newCount == 1)
            Db.KeyExpire(fullKey, window);
    }

    public void ResetAttempts(string key)
        => Db.KeyDelete(K(key));

    public string BuildLoginKey(string clientIp, string username)
        => $"login:{clientIp}:{username.ToLower().Trim()}";
}
