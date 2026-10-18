# Commun aux deux processus PowerShell : encodage UTF-8 + helper pour attendre les appels WinRT.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$global:AsTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function global:Await($op, [Type]$type) {
    $task = $global:AsTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
    $null = $task.Wait(-1)
    $task.Result
}

$global:AsTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
})[0]

function global:AwaitAction($op) {
    $task = $global:AsTaskAction.Invoke($null, @($op))
    $null = $task.Wait(-1)
}

# Texte reçu de l'interface, encodé en base64 pour éviter tout souci de guillemets.
function global:FromB64([string]$s) {
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s))
}

function global:Safe([scriptblock]$block) {
    try { & $block } catch { $null }
}

# Code C# partagé avec le moteur compilé (src/native/*.cs)
$global:NativeDir = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'native'
function global:Get-NativeSource([string]$name) { [IO.File]::ReadAllText((Join-Path $global:NativeDir "$name.cs")) }

# Compile le code C# une seule fois puis réutilise la DLL (démarrage beaucoup plus rapide).
function global:Add-CachedType([string]$name, [string]$src, [string[]]$refs = @()) {
    $dir = if ($env:HUB_CACHE) { $env:HUB_CACHE } else { Join-Path $env:TEMP 'hub-pilule' }
    $null = New-Item -ItemType Directory -Force -Path $dir -ErrorAction SilentlyContinue
    $sha = [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($src))).Replace('-', '').Substring(0, 12)
    $dll = Join-Path $dir "$name-$sha.dll"
    if (-not (Test-Path -LiteralPath $dll)) {
        try { Add-Type -TypeDefinition $src -ReferencedAssemblies $refs -OutputAssembly $dll -ErrorAction Stop }
        catch { Add-Type -TypeDefinition $src -ReferencedAssemblies $refs; return }
    }
    try { Add-Type -LiteralPath $dll -ErrorAction Stop } catch { Add-Type -TypeDefinition $src -ReferencedAssemblies $refs }
}

function global:Emit([string]$line) {
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
}
