# Rayfin Fabricator deployment

`deploy.ps1` provisions the Azure telemetry and binary distribution infrastructure for the Electron app, writes local build endpoints, and can optionally build and upload Windows installer artifacts.

## Prerequisites

- PowerShell 7 (`pwsh`)
- Azure CLI (`az`) with access to subscription `57a3a6e5-037c-4ae2-97a3-2ec2e02c461a`
- GitHub CLI (`gh`) authenticated to `spatney/rayfin-desktop` for automatic Actions secret wiring
- Node.js/npm for local builds

## What it provisions

- Resource group `rayfin-desktop`
- Log Analytics workspace `rayfin-desktop-logs`
- Workspace-based Application Insights `rayfin-desktop-insights`
- Storage account named deterministically from the subscription id
- Public `downloads` blob container for installers
- Lifecycle deletion for `downloads/` blobs older than 60 days
- Resource-group monthly Azure budget alerts at 80% and 100%

## Cost posture

The intended steady-state cost is near $0 for light usage: Application Insights has a 5 GB/month free grant and the script sets a strict 0.1 GB/day ingestion cap; Azure bandwidth includes 100 GB/month free egress; and the default $5 monthly budget sends alert emails.

## Run

From the repo root:

```powershell
pwsh -NoProfile -File .\deploy.ps1
```

To provision and wire endpoints without building locally:

```powershell
pwsh -NoProfile -File .\deploy.ps1 -BuildLocal:$false
```

The script writes `resources/telemetry.json` and `.deploy.state.json`. If `gh` is unavailable or not authenticated, it prints the Actions secrets/variable to add manually.

## Cut a release

Push a version tag to trigger the GitHub Actions release workflow that builds and uploads both Windows and macOS installers:

```powershell
git tag v0.1.0
git push origin v0.1.0
```
