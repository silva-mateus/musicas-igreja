using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services;

public interface IAlertConfigurationService
{
    Task<List<AlertConfiguration>> GetAllConfigurationsAsync();
    Task<AlertConfiguration?> GetConfigurationByKeyAsync(string configKey);
    Task<AlertConfiguration?> GetConfigurationByIdAsync(int id);
    Task<AlertConfiguration> CreateConfigurationAsync(AlertConfiguration config);
    Task<AlertConfiguration> UpdateConfigurationAsync(int id, AlertConfiguration config);
    Task DeleteConfigurationAsync(int id);
    Task<bool> ShouldTriggerAlert(string metricType, double value, string unit);
    Task<List<AlertConfiguration>> GetTriggeredAlertsAsync(string metricType, double value, string unit);
}
