namespace MusicasIgreja.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public int RoleId { get; set; } = 1; // References Role.Id (1 = Viewer by default)
    public Role? Role { get; set; } // Navigation property
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; } = true;
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginDate { get; set; }
}

// Keep enum for backwards compatibility in API responses
public enum UserRoleLevel
{
    Viewer = 1,
    Editor = 2,
    Uploader = 3,
    Admin = 4
}
