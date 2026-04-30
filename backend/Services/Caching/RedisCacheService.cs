using System.Text.Json;
using StackExchange.Redis;

namespace MusicasIgreja.Api.Services.Caching;

/// <summary>
/// Redis-backed cache with tag-based invalidation.
/// Tags are stored as Redis sets (key = "{instance}tag:{name}") containing
/// the value-keys associated with that tag. Invalidation pipelines a SMEMBERS
/// followed by DEL for each member plus DEL of the tag set itself.
/// All values are serialized as JSON via System.Text.Json.
/// </summary>
public sealed class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisCacheService> _logger;
    private readonly string _instance;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    public RedisCacheService(
        IConnectionMultiplexer redis,
        IConfiguration config,
        ILogger<RedisCacheService> logger)
    {
        _redis = redis;
        _logger = logger;
        _instance = config["Cache:InstanceName"] ?? "musicas:";
    }

    private IDatabase Db => _redis.GetDatabase();
    private string K(string key) => _instance + key;
    private string TagK(string tag) => _instance + "tag:" + tag;

    public async Task<T?> GetOrSetAsync<T>(
        string key,
        TimeSpan ttl,
        Func<Task<T?>> factory,
        params string[] tags) where T : class
    {
        var fullKey = K(key);

        try
        {
            var cached = await Db.StringGetAsync(fullKey);
            if (cached.HasValue)
            {
                try { return JsonSerializer.Deserialize<T>(cached!, JsonOpts); }
                catch (JsonException) { /* corrupt entry; fall through to refresh */ }
            }
        }
        catch (RedisException ex)
        {
            _logger.LogWarning(ex, "Redis GET failed for {Key}; falling back to factory", fullKey);
            return await factory();
        }

        var value = await factory();
        if (value is null) return null;

        try
        {
            var payload = JsonSerializer.Serialize(value, JsonOpts);
            var tx = Db.CreateTransaction();
            _ = tx.StringSetAsync(fullKey, payload, ttl);
            foreach (var tag in tags)
            {
                _ = tx.SetAddAsync(TagK(tag), fullKey);
                // Tag set itself does not expire; pruned only on explicit invalidation.
            }
            await tx.ExecuteAsync();
        }
        catch (RedisException ex)
        {
            _logger.LogWarning(ex, "Redis SET failed for {Key}", fullKey);
        }

        return value;
    }

    public async Task InvalidateAsync(string key)
    {
        try { await Db.KeyDeleteAsync(K(key)); }
        catch (RedisException ex) { _logger.LogWarning(ex, "Redis DEL failed for {Key}", key); }
    }

    public async Task InvalidateTagAsync(string tag)
    {
        var tagKey = TagK(tag);
        try
        {
            var members = await Db.SetMembersAsync(tagKey);
            if (members.Length > 0)
            {
                var keys = members.Select(m => (RedisKey)m.ToString()).ToArray();
                await Db.KeyDeleteAsync(keys);
            }
            await Db.KeyDeleteAsync(tagKey);
        }
        catch (RedisException ex)
        {
            _logger.LogWarning(ex, "Redis tag invalidation failed for {Tag}", tag);
        }
    }
}
