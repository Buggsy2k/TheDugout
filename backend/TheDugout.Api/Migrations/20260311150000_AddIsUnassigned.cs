using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TheDugout.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsUnassigned : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUnassigned",
                table: "Cards",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.DropIndex(
                name: "IX_Card_Location",
                table: "Cards");

            migrationBuilder.CreateIndex(
                name: "IX_Card_Location",
                table: "Cards",
                columns: new[] { "BinderNumber", "PageNumber", "Row", "Column" },
                unique: true,
                filter: "\"IsUnassigned\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Card_Location",
                table: "Cards");

            migrationBuilder.DropColumn(
                name: "IsUnassigned",
                table: "Cards");

            migrationBuilder.CreateIndex(
                name: "IX_Card_Location",
                table: "Cards",
                columns: new[] { "BinderNumber", "PageNumber", "Row", "Column" },
                unique: true);
        }
    }
}
