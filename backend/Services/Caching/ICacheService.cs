namespace MusicasIgreja.Api.Services.Caching;

/// <summary>
/// App-level cache abstraction. Implementations may be Redis-backed (distributed)
/// or in-memory (fallback when Redis is not configured).
/// Tag-based invalidation: writers may attach tags to a key, and a single
/// InvalidateTagAsync call removes every key associated with that tag.
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Read-through cache: returns cached value if present, otherwise invokes
    /// <paramref name="factory"/>, stores its result with <paramref name="ttl"/>,
    /// and associates it with the given <paramref name="tags"/>.
    /// </summary>
    Task<T?> GetOrSetAsync<T>(
        string key,
        TimeSpan ttl,
        Func<Task<T?>> factory,
        params string[] tags) where T : class;

    /// <summary>Removes a single key from the cache.</summary>
    Task InvalidateAsync(string key);

    /// <summary>Removes every key that was registered under the given tag.</summary>
    Task InvalidateTagAsync(string tag);
}
