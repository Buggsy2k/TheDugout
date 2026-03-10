using Microsoft.AspNetCore.Mvc;
using TheDugout.Api.DTOs;
using TheDugout.Api.Services;

namespace TheDugout.Api.Controllers;

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

    [HttpPost]
    public async Task<ActionResult<BinderDto>> CreateBinder([FromBody] CreateBinderDto dto)
    {
        var binder = await _binderService.CreateBinderAsync(dto);
        return CreatedAtAction(nameof(GetBinder), new { id = binder.Id }, binder);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<BinderDto>> UpdateBinder(int id, [FromBody] UpdateBinderDto dto)
    {
        var binder = await _binderService.UpdateBinderAsync(id, dto);
        if (binder == null) return NotFound();
        return Ok(binder);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBinder(int id, [FromQuery] bool cascade = false)
    {
        var deleted = await _binderService.DeleteBinderAsync(id, cascade);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
