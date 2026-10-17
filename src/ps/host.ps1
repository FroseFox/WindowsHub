# Point d'entrée PowerShell du hub.
#   -Mode main   : toujours lancé. Exécute les commandes ET surveille le système (watch.ps1).
#   -Mode worker : lancé seulement quand il faut (listes Wi-Fi/Bluetooth, stats, applis...), arrêté après inactivité.
# Protocole : Electron envoie "<id> <script en base64>" ; on répond "@R <id> <json>". Les changements arrivent en "@E <json>".
param([string]$Mode = 'main')

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'common.ps1')
. (Join-Path $here 'system.ps1')
if ($Mode -eq 'main') {
    . (Join-Path $here 'media.ps1')
    . (Join-Path $here 'watch.ps1')
} else {
    . (Join-Path $here 'stats.ps1')
}

function global:Run-Line([string]$line) {
    $sp = $line.IndexOf(' ')
    if ($sp -lt 1) { return }
    $id = $line.Substring(0, $sp)
    try {
        $code = FromB64 $line.Substring($sp + 1)
        $r = . ([ScriptBlock]::Create($code))
        $json = if ($null -ne $r) { ConvertTo-Json -InputObject $r -Compress -Depth 5 } else { 'null' }
    } catch {
        $json = ConvertTo-Json -InputObject @{ __error = $_.Exception.Message } -Compress
    }
    Emit "@R $id $json"
}

$stdin = New-Object System.IO.StreamReader -ArgumentList ([Console]::OpenStandardInput()), (New-Object System.Text.UTF8Encoding $false)
Emit '@READY'

if ($Mode -ne 'main') {
    while ($null -ne ($l = $stdin.ReadLine())) { Run-Line $l }
    exit
}

# Boucle principale : on attend soit une commande, soit le prochain contrôle prévu (sans tourner dans le vide).
$pending = $stdin.ReadLineAsync()
while ($true) {
    while ($pending.IsCompleted) {
        $l = $pending.Result
        if ($null -eq $l) { exit }   # Electron s'est fermé
        Run-Line $l
        $pending = $stdin.ReadLineAsync()
    }
    Watch-Tick
    $null = $pending.Wait([int]$global:W.wait)
}
