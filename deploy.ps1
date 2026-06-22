#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [string]$SubscriptionId = '57a3a6e5-037c-4ae2-97a3-2ec2e02c461a',
    [string]$ResourceGroup = 'rayfin-desktop',
    [string]$Location = 'eastus2',
    [string]$LogAnalyticsName = 'rayfin-desktop-logs',
    [string]$AppInsightsName = 'rayfin-desktop-insights',
    [string]$Repo = 'spatney/rayfin-desktop',
    [decimal]$BudgetAmount = 5,
    [switch]$BuildLocal = $true,
    [string]$AlertEmail
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$StatePath = Join-Path $ScriptRoot '.deploy.state.json'
$TelemetryPath = Join-Path $ScriptRoot 'resources\telemetry.json'
$LifecyclePolicyPath = Join-Path $ScriptRoot '.deploy.lifecycle-policy.json'
$ContainerName = 'downloads'
$BudgetName = 'rayfin-desktop-budget'
$DailyCapGb = 0.1

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Info {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "    $Message"
}

function Invoke-CommandChecked {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$AllowFailure,
        [switch]$Quiet
    )

    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | Out-String).Trim()
    if ($exitCode -ne 0) {
        if ($AllowFailure) {
            if (-not $Quiet -and $text) { Write-Verbose $text }
            return $null
        }
        throw "Command failed ($FilePath $($Arguments -join ' ')): $text"
    }
    return $text
}

function Invoke-Az {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$AllowFailure,
        [switch]$Quiet
    )

    $argsWithSubscription = @($Arguments)
    if ($SubscriptionId -and -not ($argsWithSubscription -contains '--subscription')) {
        $argsWithSubscription += @('--subscription', $SubscriptionId)
    }

    return Invoke-CommandChecked -FilePath 'az' -Arguments $argsWithSubscription -AllowFailure:$AllowFailure -Quiet:$Quiet
}

function Get-StorageAccountName {
    param([Parameter(Mandatory)][string]$SubId)

    if (Test-Path -LiteralPath $StatePath) {
        try {
            $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
            if ($state.storageAccount -and ($state.storageAccount -match '^[a-z0-9]{3,24}$')) {
                return [string]$state.storageAccount
            }
        }
        catch {
            Write-Warning "Ignoring unreadable state file $StatePath`: $($_.Exception.Message)"
        }
    }

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($SubId)
        $hash = $sha.ComputeHash($bytes)
        $hex = -join ($hash | ForEach-Object { $_.ToString('x2') })
        return ('rayfindesktop' + $hex.Substring(0, 8)).Substring(0, 21)
    }
    finally {
        $sha.Dispose()
    }
}

function Mask-Secret {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return '<empty>' }
    if ($Value.Length -le 16) { return ('*' * $Value.Length) }
    return "$($Value.Substring(0, 8))...$($Value.Substring($Value.Length - 6))"
}

function Ensure-Executable {
    param([Parameter(Mandatory)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-AzureLogin {
    Write-Step 'Checking Azure CLI login'
    if (-not (Ensure-Executable 'az')) {
        throw 'Azure CLI (az) is required on PATH. Install it from https://learn.microsoft.com/cli/azure/install-azure-cli and re-run this script.'
    }

    $account = Invoke-CommandChecked -FilePath 'az' -Arguments @('account', 'show', '-o', 'json') -AllowFailure -Quiet
    if (-not $account) {
        Write-Info 'Azure CLI is not logged in; launching az login.'
        Invoke-CommandChecked -FilePath 'az' -Arguments @('login', '-o', 'none') | Out-Null
    }

    Invoke-CommandChecked -FilePath 'az' -Arguments @('account', 'set', '--subscription', $SubscriptionId) | Out-Null
    Write-Info "Using subscription $SubscriptionId"
}

function Ensure-AppInsightsExtension {
    Write-Step 'Checking Azure Application Insights extension'
    $extension = Invoke-CommandChecked -FilePath 'az' -Arguments @('extension', 'show', '-n', 'application-insights', '-o', 'json') -AllowFailure -Quiet
    if (-not $extension) {
        Write-Info 'Installing application-insights extension.'
        Invoke-CommandChecked -FilePath 'az' -Arguments @('extension', 'add', '-n', 'application-insights', '-y', '-o', 'none') | Out-Null
    }
}

function Ensure-GitHubCli {
    Write-Step 'Checking GitHub CLI'
    if (Ensure-Executable 'gh') { return $true }

    Write-Warning 'GitHub CLI (gh) was not found. Attempting winget install.'
    if (Ensure-Executable 'winget') {
        try {
            Invoke-CommandChecked -FilePath 'winget' -Arguments @('install', '--id', 'GitHub.cli', '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements') | Out-Null
        }
        catch {
            Write-Warning "winget could not install GitHub CLI: $($_.Exception.Message)"
        }
    }
    else {
        Write-Warning 'winget is not available; skipping GitHub CLI installation.'
    }

    if (Ensure-Executable 'gh') { return $true }
    Write-Warning 'GitHub CLI is still unavailable. GitHub Actions wiring values will be printed instead.'
    return $false
}

function Ensure-ProviderRegistered {
    param([Parameter(Mandatory)][string]$ProviderNamespace)

    Write-Step "Registering provider $ProviderNamespace"
    Invoke-Az -Arguments @('provider', 'register', '-n', $ProviderNamespace, '-o', 'none') -AllowFailure -Quiet | Out-Null

    $deadline = (Get-Date).AddMinutes(5)
    do {
        $state = Invoke-Az -Arguments @('provider', 'show', '-n', $ProviderNamespace, '--query', 'registrationState', '-o', 'tsv') -AllowFailure -Quiet
        $state = if ($state) { $state.Trim() } else { 'Unknown' }
        Write-Info "$ProviderNamespace registrationState=$state"
        if ($state -eq 'Registered') { return }
        Start-Sleep -Seconds 10
    } while ((Get-Date) -lt $deadline)

    throw "Provider $ProviderNamespace did not reach Registered state within 5 minutes."
}

function Ensure-ResourceGroup {
    Write-Step "Ensuring resource group $ResourceGroup"
    Invoke-Az -Arguments @('group', 'create', '-n', $ResourceGroup, '-l', $Location, '-o', 'none') | Out-Null
}

function Ensure-Workspace {
    Write-Step "Ensuring Log Analytics workspace $LogAnalyticsName"
    $workspaceJson = Invoke-Az -Arguments @('monitor', 'log-analytics', 'workspace', 'show', '-g', $ResourceGroup, '-n', $LogAnalyticsName, '-o', 'json') -AllowFailure -Quiet
    if (-not $workspaceJson) {
        Invoke-Az -Arguments @('monitor', 'log-analytics', 'workspace', 'create', '-g', $ResourceGroup, '-n', $LogAnalyticsName, '-l', $Location, '-o', 'none') | Out-Null
        $workspaceJson = Invoke-Az -Arguments @('monitor', 'log-analytics', 'workspace', 'show', '-g', $ResourceGroup, '-n', $LogAnalyticsName, '-o', 'json')
    }

    $workspace = $workspaceJson | ConvertFrom-Json
    return [string]$workspace.id
}

function Ensure-AppInsights {
    param([Parameter(Mandatory)][string]$WorkspaceId)

    Write-Step "Ensuring Application Insights component $AppInsightsName"
    $componentJson = Invoke-Az -Arguments @('monitor', 'app-insights', 'component', 'show', '--app', $AppInsightsName, '-g', $ResourceGroup, '-o', 'json') -AllowFailure -Quiet
    if (-not $componentJson) {
        Invoke-Az -Arguments @('monitor', 'app-insights', 'component', 'create', '--app', $AppInsightsName, '-g', $ResourceGroup, '-l', $Location, '--workspace', $WorkspaceId, '--application-type', 'other', '-o', 'none') | Out-Null
        $componentJson = Invoke-Az -Arguments @('monitor', 'app-insights', 'component', 'show', '--app', $AppInsightsName, '-g', $ResourceGroup, '-o', 'json')
    }

    $component = $componentJson | ConvertFrom-Json
    $connectionString = Invoke-Az -Arguments @('monitor', 'app-insights', 'component', 'show', '--app', $AppInsightsName, '-g', $ResourceGroup, '--query', 'connectionString', '-o', 'tsv')
    if ([string]::IsNullOrWhiteSpace($connectionString)) {
        throw 'Application Insights connection string was empty.'
    }

    Set-AppInsightsDailyCap -ComponentId ([string]$component.id)
    return $connectionString.Trim()
}

function Set-AppInsightsDailyCap {
    param([Parameter(Mandatory)][string]$ComponentId)

    Write-Step "Setting Application Insights daily ingestion cap to $DailyCapGb GB/day"
    try {
        Invoke-Az -Arguments @('monitor', 'app-insights', 'component', 'billing', 'update', '--app', $AppInsightsName, '-g', $ResourceGroup, '--cap', [string]$DailyCapGb, '-o', 'none') | Out-Null
        return
    }
    catch {
        Write-Warning "az monitor app-insights component billing update failed; trying REST fallback. $($_.Exception.Message)"
    }

    try {
        $body = @{
            DataVolumeCap = @{
                Cap = [double]$DailyCapGb
                ResetTime = 24
                StopSendNotificationWhenHitCap = $true
            }
        } | ConvertTo-Json -Depth 10 -Compress
        $url = "$ComponentId/CurrentBillingFeatures?api-version=2015-05-01"
        Invoke-Az -Arguments @('rest', '--method', 'put', '--url', $url, '--body', $body, '-o', 'none') | Out-Null
    }
    catch {
        Write-Warning "Could not set Application Insights daily cap; please verify it in Azure Portal. $($_.Exception.Message)"
    }
}

function Ensure-StorageAccount {
    param([Parameter(Mandatory)][string]$StorageAccountName)

    Write-Step "Ensuring storage account $StorageAccountName"
    $storage = Invoke-Az -Arguments @('storage', 'account', 'show', '-n', $StorageAccountName, '-g', $ResourceGroup, '-o', 'json') -AllowFailure -Quiet
    if (-not $storage) {
        Invoke-Az -Arguments @('storage', 'account', 'create', '-n', $StorageAccountName, '-g', $ResourceGroup, '-l', $Location, '--sku', 'Standard_LRS', '--kind', 'StorageV2', '--allow-blob-public-access', 'true', '--min-tls-version', 'TLS1_2', '-o', 'none') | Out-Null
    }

    $connectionString = Invoke-Az -Arguments @('storage', 'account', 'show-connection-string', '-n', $StorageAccountName, '-g', $ResourceGroup, '--query', 'connectionString', '-o', 'tsv')
    if ([string]::IsNullOrWhiteSpace($connectionString)) {
        throw 'Azure Storage connection string was empty.'
    }

    Write-Step "Ensuring blob container $ContainerName with anonymous blob read"
    $containerExists = Invoke-Az -Arguments @('storage', 'container', 'exists', '-n', $ContainerName, '--account-name', $StorageAccountName, '--connection-string', $connectionString.Trim(), '--query', 'exists', '-o', 'tsv') -AllowFailure -Quiet
    if (($containerExists -as [string]).Trim() -ne 'true') {
        Invoke-Az -Arguments @('storage', 'container', 'create', '-n', $ContainerName, '--account-name', $StorageAccountName, '--connection-string', $connectionString.Trim(), '--public-access', 'blob', '-o', 'none') | Out-Null
    }
    Set-StorageLifecyclePolicy -StorageAccountName $StorageAccountName

    return $connectionString.Trim()
}

function Set-StorageLifecyclePolicy {
    param([Parameter(Mandatory)][string]$StorageAccountName)

    Write-Step 'Ensuring storage lifecycle rule deletes downloads older than 60 days'
    try {
        $policy = @{
            rules = @(
                @{
                    enabled = $true
                    name = 'delete-downloads-after-60-days'
                    type = 'Lifecycle'
                    definition = @{
                        filters = @{
                            blobTypes = @('blockBlob')
                            prefixMatch = @("$ContainerName/")
                        }
                        actions = @{
                            baseBlob = @{
                                delete = @{
                                    daysAfterModificationGreaterThan = 60
                                }
                            }
                        }
                    }
                }
            )
        }
        $policy | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $LifecyclePolicyPath -Encoding utf8
        Invoke-Az -Arguments @('storage', 'account', 'management-policy', 'create', '--account-name', $StorageAccountName, '-g', $ResourceGroup, '--policy', $LifecyclePolicyPath, '-o', 'none') | Out-Null
    }
    catch {
        Write-Warning "Could not create storage lifecycle management policy. $($_.Exception.Message)"
    }
    finally {
        Remove-Item -LiteralPath $LifecyclePolicyPath -Force -ErrorAction SilentlyContinue
    }
}

function Ensure-Budget {
    param([Parameter(Mandatory)][string]$Email)

    Write-Step "Ensuring monthly $BudgetAmount USD budget alert"
    try {
        $existing = Invoke-Az -Arguments @('consumption', 'budget', 'show', '--budget-name', $BudgetName, '--resource-group', $ResourceGroup, '-o', 'json') -AllowFailure -Quiet
        if ($existing) { return }

        $startDate = Get-Date -Format 'yyyy-MM-01'
        $endDate = (Get-Date).AddYears(10).ToString('yyyy-MM-01')
        Invoke-Az -Arguments @(
            'consumption', 'budget', 'create-with-rg',
            '--budget-name', $BudgetName,
            '--resource-group', $ResourceGroup,
            '--amount', [string]$BudgetAmount,
            '--time-grain', 'Monthly',
            '--start-date', $startDate,
            '--end-date', $endDate,
            '--category', 'Cost',
            '--notifications', "Actual_GreaterThan_80_Percent:{enabled:true,operator:GreaterThan,threshold:80,contactEmails:['$Email']}", "Actual_GreaterThan_100_Percent:{enabled:true,operator:GreaterThan,threshold:100,contactEmails:['$Email']}",
            '-o', 'none'
        ) | Out-Null
        return
    }
    catch {
        Write-Warning "Azure CLI consumption budget command failed; trying ARM REST fallback. $($_.Exception.Message)"
    }

    try {
        $scope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
        $budgetBody = @{
            properties = @{
                category = 'Cost'
                amount = [double]$BudgetAmount
                timeGrain = 'Monthly'
                timePeriod = @{
                    startDate = (Get-Date -Format 'yyyy-MM-01T00:00:00Z')
                    endDate = (Get-Date).AddYears(10).ToString('yyyy-MM-01T00:00:00Z')
                }
                notifications = @{
                    Actual_GreaterThan_80_Percent = @{
                        enabled = $true
                        operator = 'GreaterThan'
                        threshold = 80
                        contactEmails = @($Email)
                    }
                    Actual_GreaterThan_100_Percent = @{
                        enabled = $true
                        operator = 'GreaterThan'
                        threshold = 100
                        contactEmails = @($Email)
                    }
                }
            }
        } | ConvertTo-Json -Depth 20 -Compress
        Invoke-Az -Arguments @('rest', '--method', 'put', '--url', "https://management.azure.com$scope/providers/Microsoft.Consumption/budgets/$BudgetName?api-version=2023-05-01", '--body', $budgetBody, '-o', 'none') | Out-Null
    }
    catch {
        Write-Warning "Could not create Azure Consumption budget; please create it manually in Azure Portal. $($_.Exception.Message)"
    }
}

function Write-EndpointFiles {
    param(
        [Parameter(Mandatory)][string]$ConnectionString,
        [Parameter(Mandatory)][string]$DownloadBaseUrl,
        [Parameter(Mandatory)][string]$StorageAccountName
    )

    Write-Step 'Writing endpoint files'
    $resourcesDir = Split-Path -Parent $TelemetryPath
    if (-not (Test-Path -LiteralPath $resourcesDir)) {
        New-Item -ItemType Directory -Path $resourcesDir | Out-Null
    }

    [ordered]@{
        connectionString = $ConnectionString
        downloadBaseUrl = $DownloadBaseUrl
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $TelemetryPath -Encoding utf8

    [ordered]@{
        subscriptionId = $SubscriptionId
        resourceGroup = $ResourceGroup
        location = $Location
        logAnalyticsName = $LogAnalyticsName
        appInsightsName = $AppInsightsName
        storageAccount = $StorageAccountName
        downloadBaseUrl = $DownloadBaseUrl
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $StatePath -Encoding utf8
}

function Set-GitHubActionsValues {
    param(
        [Parameter(Mandatory)][string]$ConnectionString,
        [Parameter(Mandatory)][string]$StorageConnectionString,
        [Parameter(Mandatory)][string]$DownloadBaseUrl,
        [Parameter(Mandatory)][bool]$GhAvailable
    )

    Write-Step 'Wiring GitHub Actions secrets and variables'
    $canUseGh = $false
    if ($GhAvailable) {
        $status = Invoke-CommandChecked -FilePath 'gh' -Arguments @('auth', 'status') -AllowFailure -Quiet
        $canUseGh = [bool]$status
    }

    if ($canUseGh) {
        try {
            $ConnectionString | & gh secret set APPINSIGHTS_CONNECTION_STRING -R $Repo --body-file - | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'gh secret set APPINSIGHTS_CONNECTION_STRING failed.' }
            $StorageConnectionString | & gh secret set AZURE_STORAGE_CONNECTION_STRING -R $Repo --body-file - | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'gh secret set AZURE_STORAGE_CONNECTION_STRING failed.' }
            & gh variable set DOWNLOAD_BASE_URL -R $Repo --body $DownloadBaseUrl | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'gh variable set DOWNLOAD_BASE_URL failed.' }
            Write-Info "GitHub Actions values set for $Repo."
            return
        }
        catch {
            Write-Warning "GitHub CLI wiring failed; printing manual instructions. $($_.Exception.Message)"
        }
    }

    Write-Warning 'GitHub CLI is unavailable or not authenticated. Add these in GitHub: Settings -> Secrets and variables -> Actions.'
    Write-Host ''
    Write-Host 'GitHub Actions values to configure:' -ForegroundColor Yellow
    Write-Host "  Secret:   APPINSIGHTS_CONNECTION_STRING = $(Mask-Secret $ConnectionString)"
    Write-Host "  Secret:   AZURE_STORAGE_CONNECTION_STRING = $(Mask-Secret $StorageConnectionString)"
    Write-Host "  Variable: DOWNLOAD_BASE_URL = $DownloadBaseUrl"
    Write-Host '  Re-run this script after gh auth login to set secrets automatically.'
}

function Invoke-LocalBuildAndUpload {
    param(
        [Parameter(Mandatory)][string]$StorageAccountName,
        [Parameter(Mandatory)][string]$StorageConnectionString,
        [Parameter(Mandatory)][string]$DownloadBaseUrl
    )

    Write-Step 'Building local Windows installer and uploading artifacts'
    Push-Location -LiteralPath $ScriptRoot
    try {
        if (Test-Path -LiteralPath (Join-Path $ScriptRoot 'package-lock.json')) {
            Invoke-CommandChecked -FilePath 'npm' -Arguments @('ci') | Out-Host
        }
        else {
            Invoke-CommandChecked -FilePath 'npm' -Arguments @('install') | Out-Host
        }
        Invoke-CommandChecked -FilePath 'npm' -Arguments @('run', 'build') | Out-Host
        Invoke-CommandChecked -FilePath 'npx' -Arguments @('electron-builder', '--win') | Out-Host

        foreach ($pattern in @('*.exe', '*.blockmap', 'latest*.yml')) {
            try {
                Invoke-Az -Arguments @('storage', 'blob', 'upload-batch', '-d', $ContainerName, '-s', 'dist', '--pattern', $pattern, '--account-name', $StorageAccountName, '--connection-string', $StorageConnectionString, '--overwrite', 'true', '-o', 'none') | Out-Null
            }
            catch {
                if ($pattern -eq '*.exe') { throw }
                Write-Warning "Best-effort upload for $pattern failed. $($_.Exception.Message)"
            }
        }

        $distPath = Join-Path $ScriptRoot 'dist'
        if (Test-Path -LiteralPath $distPath) {
            Get-ChildItem -LiteralPath $distPath -File | Where-Object { $_.Name -like '*.exe' -or $_.Name -like '*.blockmap' -or $_.Name -like 'latest*.yml' } | ForEach-Object {
                Write-Host "$DownloadBaseUrl$([System.Uri]::EscapeDataString($_.Name))"
            }
        }
    }
    finally {
        Pop-Location
    }
}

try {
    Ensure-AzureLogin
    Ensure-AppInsightsExtension
    $ghAvailable = Ensure-GitHubCli

    if ([string]::IsNullOrWhiteSpace($AlertEmail)) {
        $AlertEmail = (Invoke-Az -Arguments @('account', 'show', '--query', 'user.name', '-o', 'tsv')).Trim()
    }

    foreach ($provider in @('Microsoft.Insights', 'Microsoft.OperationalInsights', 'Microsoft.Storage')) {
        Ensure-ProviderRegistered -ProviderNamespace $provider
    }

    $storageAccountName = Get-StorageAccountName -SubId $SubscriptionId
    $downloadBaseUrl = "https://$storageAccountName.blob.core.windows.net/$ContainerName/"

    Ensure-ResourceGroup
    $workspaceId = Ensure-Workspace
    $appInsightsConnectionString = Ensure-AppInsights -WorkspaceId $workspaceId
    $storageConnectionString = Ensure-StorageAccount -StorageAccountName $storageAccountName
    Ensure-Budget -Email $AlertEmail
    Write-EndpointFiles -ConnectionString $appInsightsConnectionString -DownloadBaseUrl $downloadBaseUrl -StorageAccountName $storageAccountName
    Set-GitHubActionsValues -ConnectionString $appInsightsConnectionString -StorageConnectionString $storageConnectionString -DownloadBaseUrl $downloadBaseUrl -GhAvailable $ghAvailable

    if ($BuildLocal) {
        Invoke-LocalBuildAndUpload -StorageAccountName $storageAccountName -StorageConnectionString $storageConnectionString -DownloadBaseUrl $downloadBaseUrl
    }
    else {
        Write-Step 'Skipping local build and upload because -BuildLocal is false'
    }
}
finally {
    Write-Host ''
    Write-Host 'Deployment summary' -ForegroundColor Green
    Write-Host "  Resource group:          $ResourceGroup"
    Write-Host "  Application Insights:    $AppInsightsName"
    if (Get-Variable -Name storageAccountName -ErrorAction SilentlyContinue) {
        Write-Host "  Storage account:         $storageAccountName"
    }
    if (Get-Variable -Name downloadBaseUrl -ErrorAction SilentlyContinue) {
        Write-Host "  Public download base URL: $downloadBaseUrl"
    }
    Write-Host "  Daily telemetry cap:     $DailyCapGb GB/day"
    Write-Host "  Budget guard:            `$$BudgetAmount monthly budget alert"
    Write-Host '  Release note: Push a tag like `git tag v0.1.0 && git push origin v0.1.0` to trigger the GitHub Actions release that builds + uploads BOTH Windows and macOS installers.'
}
