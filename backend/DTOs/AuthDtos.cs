using System.Text.Json.Serialization;

namespace MusicasIgreja.Api.DTOs;

public class LoginRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [JsonPropertyName("current_password")]
    public string CurrentPassword { get; set; } = string.Empty;

    [JsonPropertyName("new_password")]
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdateProfileRequest
{
    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }
}

public class CreateUserRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("role_id")]
    public int? RoleId { get; set; }
}

public class UpdateRoleRequest
{
    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("role_id")]
    public int? RoleId { get; set; }
}

public class ResetPasswordRequest
{
    [JsonPropertyName("new_password")]
    public string NewPassword { get; set; } = string.Empty;
}

public class RoleRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("display_name")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("priority")]
    public int? Priority { get; set; }

    [JsonPropertyName("permissions")]
    public PermissionsRequest? Permissions { get; set; }
}

public class PermissionsRequest
{
    [JsonPropertyName("can_view_music")]
    public bool? CanViewMusic { get; set; }

    [JsonPropertyName("can_download_music")]
    public bool? CanDownloadMusic { get; set; }

    [JsonPropertyName("can_edit_music_metadata")]
    public bool? CanEditMusicMetadata { get; set; }

    [JsonPropertyName("can_upload_music")]
    public bool? CanUploadMusic { get; set; }

    [JsonPropertyName("can_delete_music")]
    public bool? CanDeleteMusic { get; set; }

    [JsonPropertyName("can_manage_lists")]
    public bool? CanManageLists { get; set; }

    [JsonPropertyName("can_manage_categories")]
    public bool? CanManageCategories { get; set; }

    [JsonPropertyName("can_manage_users")]
    public bool? CanManageUsers { get; set; }

    [JsonPropertyName("can_manage_roles")]
    public bool? CanManageRoles { get; set; }

    [JsonPropertyName("can_access_admin")]
    public bool? CanAccessAdmin { get; set; }
}
