namespace MusicasIgreja.Api.Models;

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystemRole { get; set; } = false; // System roles cannot be deleted
    public bool IsDefault { get; set; } = false; // Default role for new users and when roles are deleted
    public int Priority { get; set; } = 0; // Higher = more permissions
    
    // Permissions flags
    public bool CanViewMusic { get; set; } = true;
    public bool CanDownloadMusic { get; set; } = true;
    public bool CanEditMusicMetadata { get; set; } = false;
    public bool CanUploadMusic { get; set; } = false;
    public bool CanDeleteMusic { get; set; } = false;
    public bool CanManageLists { get; set; } = false;
    public bool CanManageCategories { get; set; } = false;
    public bool CanManageUsers { get; set; } = false;
    public bool CanManageRoles { get; set; } = false;
    public bool CanAccessAdmin { get; set; } = false;
    
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public ICollection<User> Users { get; set; } = new List<User>();
}
