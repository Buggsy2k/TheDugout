using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TheDugout.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBackImagePath : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BackImagePath",
                table: "Cards",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackImagePath",
                table: "Cards");
        }
    }
}
