# Onglet Stats : débit réseau et charge du GPU (le CPU, la RAM et le disque sont lus directement par Node).

function global:Get-NetBytes {
    $rx = [int64]0; $tx = [int64]0
    foreach ($n in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($n.OperationalStatus -ne 'Up') { continue }
        if ($n.NetworkInterfaceType -eq 'Loopback' -or $n.NetworkInterfaceType -eq 'Tunnel') { continue }
        if ($n.Description -match 'Hyper-V|Virtual|VMware|VirtualBox|Loopback|WAN Miniport') { continue }
        try { $s = $n.GetIPStatistics(); $rx += $s.BytesReceived; $tx += $s.BytesSent } catch { }
    }
    [ordered]@{ rx = $rx; tx = $tx }
}

# Charge GPU via les compteurs de performance (comme le Gestionnaire des tâches) : quelques millisecondes,
# au lieu de la requête WMI qui pouvait prendre 10 à 30 secondes la première fois.
Add-CachedType 'HubPdh' (Get-NativeSource 'HubPdh')

function global:Get-GpuName {
    (Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object { $_.Name -notmatch 'Basic|Virtual|Parsec|Remote' } | Select-Object -First 1).Name
}

function global:Get-Stats {
    $n = Get-NetBytes
    $g = Safe { [HubPdh.Gpu]::Load() }
    [ordered]@{ rx = $n.rx; tx = $n.tx; gpu = $(if ($null -ne $g -and $g -ge 0) { [int][Math]::Round($g) } else { $null }) }
}

# ---- Icônes d'applis, demandées directement à Windows (comme le menu Démarrer) ----
Add-CachedType 'HubIcons' (Get-NativeSource 'HubIcons') @('System.Drawing')

function global:Get-AppIcon([string]$nameB64) {
    [HubIcons.Shell]::IconPng((FromB64 $nameB64), 64)
}
