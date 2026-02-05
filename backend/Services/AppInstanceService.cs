namespace MusicasIgreja.Api.Services;

/// <summary>
/// Singleton service that holds the current application instance ID.
/// Used to detect server restarts and invalidate old sessions.
/// </summary>
public interface IAppInstanceService
{
    string InstanceId { get; }
}

public class AppInstanceService : IAppInstanceService
{
    public string InstanceId { get; }

    public AppInstanceService()
    {
        // Generate unique instance ID based on startup timestamp
        InstanceId = DateTime.UtcNow.Ticks.ToString("X")[^6..];
    }
}
