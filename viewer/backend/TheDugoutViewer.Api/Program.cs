using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using TheDugoutViewer.Api.Data;
using TheDugoutViewer.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database (read-only)
builder.Services.AddDbContext<ViewerDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Services
builder.Services.AddScoped<CardService>();
builder.Services.AddScoped<BinderService>();

// Controllers
builder.Services.AddControllers();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("AllowFrontend");

// Serve uploaded card/page images
var uploadsPath = builder.Configuration["UploadsPath"]
    ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.CacheControl = "public, max-age=86400";
        if (!ctx.Context.Response.Headers.ContainsKey("Access-Control-Allow-Origin"))
        {
            ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        }
    }
});

app.UseAuthorization();
app.MapControllers();

app.Run();
