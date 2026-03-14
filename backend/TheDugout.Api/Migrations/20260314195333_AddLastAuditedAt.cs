using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TheDugout.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLastAuditedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastAuditedAt",
                table: "Cards",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastAuditedAt",
                table: "Cards");
        }
    }
}
