using Microsoft.AspNetCore.Mvc;
using TheDugoutViewer.Api.DTOs;
using TheDugoutViewer.Api.Services;

namespace TheDugoutViewer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BindersController : ControllerBase
{
    private readonly BinderService _binderService;

    public BindersController(BinderService binderService)
    {
        _binderService = binderService;
    }

    [HttpGet]
    public async Task<ActionResult<List<BinderDto>>> GetBinders()
    {
        var binders = await _binderService.GetAllBindersAsync();
        return Ok(binders);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BinderDetailDto>> GetBinder(int id)
    {
        var binder = await _binderService.GetBinderByIdAsync(id);
        if (binder == null) return NotFound();
        return Ok(binder);
    }
}
