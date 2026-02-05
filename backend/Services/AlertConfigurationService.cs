using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services;

public class AlertConfigurationService : IAlertConfigurationService
{
    private readonly AppDbContext _context;
    private readonly ILogger<AlertConfigurationService> _logger;

    public AlertConfigurationService(AppDbContext context, ILogger<AlertConfigurationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<AlertConfiguration>> GetAllConfigurationsAsync()
    {
        return await _context.AlertConfigurations
            .OrderBy(c => c.MetricType)
            .ThenBy(c => c.ThresholdValue)
            .ToListAsync();
    }

    public async Task<AlertConfiguration?> GetConfigurationByKeyAsync(string configKey)
    {
        return await _context.AlertConfigurations
            .FirstOrDefaultAsync(c => c.ConfigKey == configKey);
    }

    public async Task<AlertConfiguration?> GetConfigurationByIdAsync(int id)
    {
        return await _context.AlertConfigurations.FindAsync(id);
    }

    public async Task<AlertConfiguration> CreateConfigurationAsync(AlertConfiguration config)
    {
        config.CreatedDate = DateTime.UtcNow;
        config.UpdatedDate = null;

        _context.AlertConfigurations.Add(config);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created alert configuration: {ConfigKey}", config.ConfigKey);
        return config;
    }

    public async Task<AlertConfiguration> UpdateConfigurationAsync(int id, AlertConfiguration config)
    {
        var existing = await _context.AlertConfigurations.FindAsync(id);
        if (existing == null)
        {
            throw new InvalidOperationException($"Alert configuration with ID {id} not found");
        }

        existing.Name = config.Name;
        existing.Description = config.Description;
        existing.ThresholdValue = config.ThresholdValue;
        existing.ThresholdUnit = config.ThresholdUnit;
        existing.ComparisonOperator = config.ComparisonOperator;
        existing.Severity = config.Severity;
        existing.IsEnabled = config.IsEnabled;
        existing.UpdatedDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated alert configuration: {ConfigKey}", existing.ConfigKey);
        return existing;
    }

    public async Task DeleteConfigurationAsync(int id)
    {
        var config = await _context.AlertConfigurations.FindAsync(id);
        if (config != null)
        {
            _context.AlertConfigurations.Remove(config);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted alert configuration: {ConfigKey}", config.ConfigKey);
        }
    }

    public async Task<bool> ShouldTriggerAlert(string metricType, double value, string unit)
    {
        var configs = await GetTriggeredAlertsAsync(metricType, value, unit);
        return configs.Any();
    }

    public async Task<List<AlertConfiguration>> GetTriggeredAlertsAsync(string metricType, double value, string unit)
    {
        var enabledConfigs = await _context.AlertConfigurations
            .Where(c => c.IsEnabled && c.MetricType == metricType && c.ThresholdUnit == unit)
            .ToListAsync();

        var triggered = new List<AlertConfiguration>();

        foreach (var config in enabledConfigs)
        {
            bool shouldTrigger = config.ComparisonOperator switch
            {
                "greater_than" => value > config.ThresholdValue,
                "greater_than_or_equal" => value >= config.ThresholdValue,
                "less_than" => value < config.ThresholdValue,
                "less_than_or_equal" => value <= config.ThresholdValue,
                "equals" => Math.Abs(value - config.ThresholdValue) < 0.01,
                _ => false
            };

            if (shouldTrigger)
            {
                triggered.Add(config);
            }
        }

        return triggered;
    }
}
