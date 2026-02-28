using Core.Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public override int SaveChanges()
    {
        ChangeTracker.ApplySlugs();
        return base.SaveChanges();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ChangeTracker.ApplySlugs();
        return await base.SaveChangesAsync(cancellationToken);
    }

    public DbSet<Workspace> Workspaces { get; set; }
    public DbSet<PdfFile> PdfFiles { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Artist> Artists { get; set; }
    public DbSet<MergeList> MergeLists { get; set; }
    public DbSet<MergeListItem> MergeListItems { get; set; }
    public DbSet<FileCategory> FileCategories { get; set; }
    public DbSet<FileArtist> FileArtists { get; set; }
    public DbSet<CustomFilterGroup> CustomFilterGroups { get; set; }
    public DbSet<CustomFilterValue> CustomFilterValues { get; set; }
    public DbSet<FileCustomFilter> FileCustomFilters { get; set; }

    public DbSet<SystemEvent> SystemEvents { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<SystemMetric> SystemMetrics { get; set; }
    public DbSet<AlertConfiguration> AlertConfigurations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyCoreAuthEntities();
        modelBuilder.ApplyCoreFileEntities();

        // Workspace
        modelBuilder.Entity<Workspace>(entity =>
        {
            entity.ToTable("workspaces");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired().HasMaxLength(100);
            entity.Property(e => e.Slug).HasColumnName("slug").IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Icon).HasColumnName("icon").HasMaxLength(50);
            entity.Property(e => e.Color).HasColumnName("color").HasMaxLength(20);
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.CreatedDate).HasColumnName("created_date");
            entity.HasIndex(e => e.Slug).IsUnique();
        });

        // PdfFile
        modelBuilder.Entity<PdfFile>(entity =>
        {
            entity.ToTable("pdf_files");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Filename).HasColumnName("filename").IsRequired();
            entity.Property(e => e.OriginalName).HasColumnName("original_name").IsRequired();
            entity.Property(e => e.SongName).HasColumnName("song_name");
            entity.Property(e => e.MusicalKey).HasColumnName("musical_key");
            entity.Property(e => e.YoutubeLink).HasColumnName("youtube_link");
            entity.Property(e => e.FilePath).HasColumnName("file_path").IsRequired();
            entity.Property(e => e.FileSize).HasColumnName("file_size");
            entity.Property(e => e.UploadDate).HasColumnName("upload_date");
            entity.Property(e => e.FileHash).HasColumnName("file_hash");
            entity.Property(e => e.PageCount).HasColumnName("page_count");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.WorkspaceId).HasColumnName("workspace_id");
            entity.HasIndex(e => e.FileHash).IsUnique();
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.UploadDate).IsDescending();

            entity.HasOne(e => e.Workspace)
                .WithMany(w => w.PdfFiles)
                .HasForeignKey(e => e.WorkspaceId);
        });

        // Category
        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(200).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.CreatedDate).HasColumnName("created_date");
            entity.Property(e => e.WorkspaceId).HasColumnName("workspace_id");
            entity.HasIndex(e => new { e.WorkspaceId, e.Name }).IsUnique();
            entity.HasIndex(e => new { e.WorkspaceId, e.Slug }).IsUnique();

            entity.HasOne(e => e.Workspace)
                .WithMany(w => w.Categories)
                .HasForeignKey(e => e.WorkspaceId);
        });

        // Artist (global, no workspace)
        modelBuilder.Entity<Artist>(entity =>
        {
            entity.ToTable("artists");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(200).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.CreatedDate).HasColumnName("created_date");
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.Slug).IsUnique();
        });

        // MergeList
        modelBuilder.Entity<MergeList>(entity =>
        {
            entity.ToTable("merge_lists");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Observations).HasColumnName("observations");
            entity.Property(e => e.CreatedDate).HasColumnName("created_date");
            entity.Property(e => e.UpdatedDate).HasColumnName("updated_date");
            entity.Property(e => e.WorkspaceId).HasColumnName("workspace_id");
            entity.HasIndex(e => e.WorkspaceId);

            entity.HasOne(e => e.Workspace)
                .WithMany(w => w.MergeLists)
                .HasForeignKey(e => e.WorkspaceId);
        });

        // MergeListItem
        modelBuilder.Entity<MergeListItem>(entity =>
        {
            entity.ToTable("merge_list_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MergeListId).HasColumnName("merge_list_id");
            entity.Property(e => e.PdfFileId).HasColumnName("pdf_file_id");
            entity.Property(e => e.OrderPosition).HasColumnName("order_position");
            entity.HasIndex(e => new { e.MergeListId, e.OrderPosition });

            entity.HasOne(e => e.MergeList)
                .WithMany(m => m.Items)
                .HasForeignKey(e => e.MergeListId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.PdfFile)
                .WithMany(p => p.MergeListItems)
                .HasForeignKey(e => e.PdfFileId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // FileCategory (N:N)
        modelBuilder.Entity<FileCategory>(entity =>
        {
            entity.ToTable("file_categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FileId).HasColumnName("file_id");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.HasIndex(e => new { e.FileId, e.CategoryId }).IsUnique();
            entity.HasIndex(e => e.CategoryId);

            entity.HasOne(e => e.PdfFile)
                .WithMany(p => p.FileCategories)
                .HasForeignKey(e => e.FileId);

            entity.HasOne(e => e.Category)
                .WithMany(c => c.FileCategories)
                .HasForeignKey(e => e.CategoryId);
        });

        // FileArtist (N:N)
        modelBuilder.Entity<FileArtist>(entity =>
        {
            entity.ToTable("file_artists");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FileId).HasColumnName("file_id");
            entity.Property(e => e.ArtistId).HasColumnName("artist_id");
            entity.HasIndex(e => new { e.FileId, e.ArtistId }).IsUnique();
            entity.HasIndex(e => e.ArtistId);

            entity.HasOne(e => e.PdfFile)
                .WithMany(p => p.FileArtists)
                .HasForeignKey(e => e.FileId);

            entity.HasOne(e => e.Artist)
                .WithMany(a => a.FileArtists)
                .HasForeignKey(e => e.ArtistId);
        });

        // CustomFilterGroup
        modelBuilder.Entity<CustomFilterGroup>(entity =>
        {
            entity.ToTable("custom_filter_groups");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(200).IsRequired();
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.CreatedDate).HasColumnName("created_date");
            entity.Property(e => e.WorkspaceId).HasColumnName("workspace_id");
            entity.HasIndex(e => new { e.WorkspaceId, e.Slug }).IsUnique();

            entity.HasOne(e => e.Workspace)
                .WithMany(w => w.CustomFilterGroups)
                .HasForeignKey(e => e.WorkspaceId);
        });

        // CustomFilterValue
        modelBuilder.Entity<CustomFilterValue>(entity =>
        {
            entity.ToTable("custom_filter_values");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(200).IsRequired();
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.CreatedDate).HasColumnName("created_date");
            entity.Property(e => e.FilterGroupId).HasColumnName("filter_group_id");
            entity.HasIndex(e => new { e.FilterGroupId, e.Slug }).IsUnique();

            entity.HasOne(e => e.FilterGroup)
                .WithMany(g => g.Values)
                .HasForeignKey(e => e.FilterGroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // FileCustomFilter (N:N)
        modelBuilder.Entity<FileCustomFilter>(entity =>
        {
            entity.ToTable("file_custom_filters");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FileId).HasColumnName("file_id");
            entity.Property(e => e.FilterValueId).HasColumnName("filter_value_id");
            entity.HasIndex(e => new { e.FileId, e.FilterValueId }).IsUnique();

            entity.HasOne(e => e.PdfFile)
                .WithMany(p => p.FileCustomFilters)
                .HasForeignKey(e => e.FileId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.FilterValue)
                .WithMany(v => v.FileCustomFilters)
                .HasForeignKey(e => e.FilterValueId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Seed default workspace
        modelBuilder.Entity<Workspace>().HasData(
            new Workspace { Id = 1, Name = "Igreja", Slug = "igreja", Icon = "church", SortOrder = 0 }
        );

        // Seed default categories (workspace 1)
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Aclamação", Slug = "aclamacao", WorkspaceId = 1 },
            new Category { Id = 2, Name = "Adoração", Slug = "adoracao", WorkspaceId = 1 },
            new Category { Id = 3, Name = "Ato penitencial", Slug = "ato-penitencial", WorkspaceId = 1 },
            new Category { Id = 4, Name = "Comunhão", Slug = "comunhao", WorkspaceId = 1 },
            new Category { Id = 5, Name = "Cordeiro", Slug = "cordeiro", WorkspaceId = 1 },
            new Category { Id = 6, Name = "Entrada", Slug = "entrada", WorkspaceId = 1 },
            new Category { Id = 7, Name = "Espírito Santo", Slug = "espirito-santo", WorkspaceId = 1 },
            new Category { Id = 8, Name = "Final", Slug = "final", WorkspaceId = 1 },
            new Category { Id = 9, Name = "Glória", Slug = "gloria", WorkspaceId = 1 },
            new Category { Id = 10, Name = "Maria", Slug = "maria", WorkspaceId = 1 },
            new Category { Id = 11, Name = "Ofertório", Slug = "ofertorio", WorkspaceId = 1 },
            new Category { Id = 12, Name = "Pós Comunhão", Slug = "pos-comunhao", WorkspaceId = 1 },
            new Category { Id = 13, Name = "Salmo", Slug = "salmo", WorkspaceId = 1 },
            new Category { Id = 14, Name = "Santo", Slug = "santo", WorkspaceId = 1 },
            new Category { Id = 15, Name = "Diversos", Slug = "diversos", WorkspaceId = 1 }
        );
    }
}
