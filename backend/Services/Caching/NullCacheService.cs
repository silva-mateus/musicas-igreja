namespace MusicasIgreja.Api.Services.Caching;

/// <summary>
/// No-op cache used when Redis is not configured. Always misses and just
/// invokes the factory directly. Keeps consumer code identical regardless of
/// whether Redis is available, so cache wiring never breaks the request path.
/// </summary>
public sealed class NullCacheService : ICacheService
{
    public Task<T?> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<Task<T?>> factory, params string[] tags) where T : class
        => factory();

    public Task InvalidateAsync(string key) => Task.CompletedTask;

    public Task InvalidateTagAsync(string tag) => Task.CompletedTask;
}
