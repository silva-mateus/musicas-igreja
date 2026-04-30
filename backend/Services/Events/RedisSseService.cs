using System.Text.Json;
using Core.Infrastructure.Events;
using Microsoft.AspNetCore.Http;
using StackExchange.Redis;

namespace MusicasIgreja.Api.Services.Events;

/// <summary>
/// Multi-instance SSE service. Wraps a per-instance <see cref="SseConnectionManager"/>
/// for connection bookkeeping, and uses Redis pub/sub to fan out broadcasts across
/// every backend replica.
///
/// Channel layout:
///   {instance}sse:broadcast   — generic Broadcast envelope
///   {instance}sse:client:{id} — direct send to a specific clientId (if its connection
///                                lives on another replica)
///
/// Local clients are notified via the channel subscription callback, including events
/// originating from this same instance, so the publisher does not need a separate
/// local-fanout step.
/// </summary>
public sealed class RedisSseService : ISseService, IAsyncDisposable
{
    private readonly SseConnectionManager _local;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisSseService> _logger;
    private readonly string _broadcastChannel;
    private readonly string _clientChannelPrefix;
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public RedisSseService(
        ILogger<RedisSseService> logger,
        ILogger<SseConnectionManager> innerLogger,
        IConnectionMultiplexer redis,
        IConfiguration config)
    {
        _logger = logger;
        _redis = redis;
        _local = new SseConnectionManager(innerLogger);

        var prefix = config["Cache:InstanceName"] ?? "musicas:";
        _broadcastChannel = prefix + "sse:broadcast";
        _clientChannelPrefix = prefix + "sse:client:";

        var sub = _redis.GetSubscriber();
        sub.Subscribe(RedisChannel.Literal(_broadcastChannel), OnBroadcastReceived);
        sub.Subscribe(RedisChannel.Pattern(_clientChannelPrefix + "*"), OnDirectReceived);
    }

    public int ConnectedClients => _local.ConnectedClients;

    public Task AddClientAsync(string clientId, HttpResponse response, CancellationToken cancellationToken, IEnumerable<SseEvent>? initialEvents = null)
        => _local.AddClientAsync(clientId, response, cancellationToken, initialEvents);

    public void RemoveClient(string clientId) => _local.RemoveClient(clientId);

    public Task BroadcastAsync(string eventName, object data, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(new Envelope(eventName, JsonSerializer.SerializeToElement(data, Json)), Json);
        try
        {
            return _redis.GetSubscriber().PublishAsync(RedisChannel.Literal(_broadcastChannel), payload);
        }
        catch (RedisException ex)
        {
            _logger.LogWarning(ex, "Redis publish failed; broadcasting locally only");
            return _local.BroadcastAsync(eventName, data, cancellationToken);
        }
    }

    public Task SendToClientAsync(string clientId, string eventName, object data, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(new Envelope(eventName, JsonSerializer.SerializeToElement(data, Json)), Json);
        var channel = _clientChannelPrefix + clientId;
        try
        {
            return _redis.GetSubscriber().PublishAsync(RedisChannel.Literal(channel), payload);
        }
        catch (RedisException ex)
        {
            _logger.LogWarning(ex, "Redis publish failed; sending locally only");
            return _local.SendToClientAsync(clientId, eventName, data, cancellationToken);
        }
    }

    private void OnBroadcastReceived(RedisChannel channel, RedisValue message)
    {
        if (message.IsNullOrEmpty) return;
        try
        {
            var env = JsonSerializer.Deserialize<Envelope>(message!, Json);
            if (env is null) return;
            _ = _local.BroadcastAsync(env.EventName, env.Data);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deliver SSE broadcast");
        }
    }

    private void OnDirectReceived(RedisChannel channel, RedisValue message)
    {
        if (message.IsNullOrEmpty) return;
        var channelStr = channel.ToString();
        var idx = channelStr.LastIndexOf(':');
        if (idx < 0) return;
        var clientId = channelStr[(idx + 1)..];
        try
        {
            var env = JsonSerializer.Deserialize<Envelope>(message!, Json);
            if (env is null) return;
            _ = _local.SendToClientAsync(clientId, env.EventName, env.Data);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deliver SSE direct message");
        }
    }

    public async ValueTask DisposeAsync()
    {
        try { await _redis.GetSubscriber().UnsubscribeAllAsync(); } catch { }
    }

    private sealed record Envelope(string EventName, JsonElement Data);
}
