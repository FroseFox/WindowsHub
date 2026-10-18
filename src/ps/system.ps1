# Etat et réglages système : Wi-Fi, Bluetooth, volume, mode sombre, éclairage nocturne.

Add-CachedType 'HubNative' (Get-NativeSource 'HubNative')

# ---- Radios (Wi-Fi / Bluetooth) via l'API Windows.Devices.Radios, comme le centre de notifications ----
$null = [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime]
$null = [Windows.Devices.Radios.RadioState, Windows.System.Devices, ContentType = WindowsRuntime]
$null = [Windows.Devices.Radios.RadioAccessStatus, Windows.System.Devices, ContentType = WindowsRuntime]
$null = Safe { Await ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus]) }

# Les objets "radio" sont gardés en mémoire : leur état se met à jour tout seul.
$global:RadioCache = @{}
$global:RadioCacheAt = 0
function global:Get-Radio([string]$kind) {
    $now = [Environment]::TickCount
    if (-not $global:RadioCache.Count -or [Math]::Abs($now - $global:RadioCacheAt) -gt 60000) {
        $all = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
        $global:RadioCache = @{}
        foreach ($r in $all) { $k = $r.Kind.ToString(); if (-not $global:RadioCache.ContainsKey($k)) { $global:RadioCache[$k] = $r } }
        $global:RadioCacheAt = $now
    }
    $global:RadioCache[$kind]
}

function global:Set-Radio([string]$kind, [bool]$on) {
    $r = Get-Radio $kind
    if (-not $r) { return 'NoRadio' }
    $state = if ($on) { [Windows.Devices.Radios.RadioState]::On } else { [Windows.Devices.Radios.RadioState]::Off }
    (Await ($r.SetStateAsync($state)) ([Windows.Devices.Radios.RadioAccessStatus])).ToString()
}

# Nom du réseau Wi-Fi connecté (API WinRT : quelques millisecondes, au lieu d'une requête CIM lente)
$null = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
function global:Get-WifiName {
    foreach ($p in [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()) {
        if ($p.IsWlanConnectionProfile -and $p.GetNetworkConnectivityLevel().ToString() -ne 'None') { return $p.ProfileName }
    }
    $null
}

# ---- Mode sombre ----
$global:ThemeKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'

function global:Get-DarkMode {
    $v = [Microsoft.Win32.Registry]::GetValue('HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize', 'AppsUseLightTheme', $null)
    if ($null -eq $v) { return $null }
    return ($v -eq 0)
}

function global:Set-DarkMode([bool]$dark) {
    $val = if ($dark) { 0 } else { 1 }
    Set-ItemProperty -LiteralPath $global:ThemeKey -Name AppsUseLightTheme -Value $val -Type DWord
    Set-ItemProperty -LiteralPath $global:ThemeKey -Name SystemUsesLightTheme -Value $val -Type DWord
    [HubNative.Win]::BroadcastTheme()
    'ok'
}

# ---- Eclairage nocturne (pas d'API officielle : on modifie l'état stocké par Windows) ----
$global:NightKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate'

$global:NightRegPath = 'HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate'
function global:Get-NightLight {
    $d = [Microsoft.Win32.Registry]::GetValue($global:NightRegPath, 'Data', $null)
    if (-not $d) { return $null }
    if ($d.Length -le 18) { return $null }
    return ($d[18] -eq 0x15)
}

function global:Set-NightLight([bool]$on) {
    $d = [byte[]](Get-ItemProperty -LiteralPath $global:NightKey -Name Data -ErrorAction Stop).Data
    $isOn = ($d[18] -eq 0x15)
    if ($isOn -eq $on) { return 'ok' }
    # Format connu : 41 octets éteint, 43 allumé. Si ça ne correspond pas, on ne touche à rien.
    if ($on -and $d.Length -ne 41) { return 'unsupported' }
    if (-not $on -and ($d.Length -ne 43 -or $d[23] -ne 0x10 -or $d[24] -ne 0x00)) { return 'unsupported' }
    $list = New-Object 'System.Collections.Generic.List[byte]'
    $list.AddRange($d)
    if ($on) {
        $list[18] = 0x15
        $list.InsertRange(23, [byte[]](0x10, 0x00))
    } else {
        $list[18] = 0x13
        $list.RemoveRange(23, 2)
    }
    for ($i = 10; $i -lt 15; $i++) {
        if ($list[$i] -ne 0xff) { $list[$i] = [byte]($list[$i] + 1); break }
    }
    Set-ItemProperty -LiteralPath $global:NightKey -Name Data -Value ([byte[]]$list.ToArray()) -Type Binary
    'ok'
}

# ---- Fenêtre Son : liste des sorties ----
function global:Get-AudioOutputs {
    $items = @([HubNative.Audio]::Outputs() | ForEach-Object { [ordered]@{ id = $_.Id; name = $_.Name; current = $_.IsDefault } })
    [ordered]@{ ok = $true; items = $items }
}

function global:Set-AudioOutput([string]$idB64) {
    [HubNative.Audio]::SetDefault((FromB64 $idB64))
    'ok'
}

# ---- Volume général ----
function global:Set-Volume([double]$v) { [HubNative.Audio]::SetVolume([float]$v); 'ok' }
function global:Set-Mute([bool]$m) { [HubNative.Audio]::SetMute($m); 'ok' }

# ---- Mélangeur : volume par appli + micro ----
function global:Get-Mixer {
    $apps = @([HubNative.Mixer]::Apps() | ForEach-Object { [ordered]@{ key = $_.Key; name = $_.Name; path = $_.Path; vol = $_.Volume; mute = $_.Mute; active = $_.Active } })
    $mic = $null
    if ([HubNative.Audio]::HasMic()) { $mic = [ordered]@{ name = [HubNative.Audio]::MicName(); mute = (Safe { [HubNative.Audio]::GetMicMute() }) } }
    [ordered]@{ ok = $true; items = $apps; mic = $mic }
}
function global:Set-MixerVolume([string]$keyB64, [double]$v) { [HubNative.Mixer]::SetVolume((FromB64 $keyB64), [float]$v) }
function global:Set-MixerMute([string]$keyB64, [bool]$m) { [HubNative.Mixer]::SetMute((FromB64 $keyB64), $m) }
function global:Set-MicMute([bool]$m) { [HubNative.Audio]::SetMicMute($m); 'ok' }

# ---- Fenêtre Bluetooth : appareils associés ----
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]

function global:Get-BtDevices {
    $out = New-Object System.Collections.ArrayList
    $sel = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($true)
    $infos = Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($sel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
    foreach ($i in $infos) {
        $d = Safe { Await ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($i.Id)) ([Windows.Devices.Bluetooth.BluetoothDevice]) }
        if (-not $d) { continue }
        $major = Safe { $d.ClassOfDevice.MajorClass.ToString() }
        $null = $out.Add([ordered]@{
            addr      = $d.BluetoothAddress.ToString()
            name      = if ($d.Name) { $d.Name } else { $i.Name }
            connected = $d.ConnectionStatus.ToString() -eq 'Connected'
            kind      = $major
            audio     = $major -eq 'AudioVideo'
        })
        $d.Dispose()
    }
    # Appareils Bluetooth "basse énergie" (souris, claviers...) : affichés, connexion gérée par Windows
    $selLe = [Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelectorFromPairingState($true)
    $infosLe = Safe { Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selLe)) ([Windows.Devices.Enumeration.DeviceInformationCollection]) }
    foreach ($i in @($infosLe)) {
        if (-not $i) { continue }
        $d = Safe { Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromIdAsync($i.Id)) ([Windows.Devices.Bluetooth.BluetoothLEDevice]) }
        if (-not $d) { continue }
        $name = if ($d.Name) { $d.Name } else { $i.Name }
        if ($out | Where-Object { $_.name -eq $name }) { $d.Dispose(); continue }
        $null = $out.Add([ordered]@{
            addr = $d.BluetoothAddress.ToString(); name = $name
            connected = $d.ConnectionStatus.ToString() -eq 'Connected'
            kind = 'LowEnergy'; audio = $false
        })
        $d.Dispose()
    }
    $items = @($out | Sort-Object -Property @{ Expression = { -not $_.connected } }, @{ Expression = { $_.name } })
    [ordered]@{ ok = $true; items = $items }
}

function global:Set-BtAudio([string]$addr, [bool]$connect) {
    $r = [HubNative.Bt]::SetAudioConnected([uint64]$addr, $connect)
    if ($r -eq 0) { 'ok' } else { "err$r" }
}

# ---- Fenêtre Wi-Fi : réseaux disponibles ----
$null = [Windows.Devices.WiFi.WiFiAdapter, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiAccessStatus, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiConnectionResult, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Devices.WiFi.WiFiReconnectionKind, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$null = [Windows.Security.Credentials.PasswordCredential, Windows.Security.Credentials, ContentType = WindowsRuntime]
$global:WifiNets = @{}

function global:Get-WifiAdapter {
    $adapters = Await ([Windows.Devices.WiFi.WiFiAdapter]::FindAllAdaptersAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.WiFi.WiFiAdapter]])
    $adapters | Select-Object -First 1
}

function global:Get-KnownWifi {
    $known = @{}
    $txt = netsh wlan show profiles 2>$null
    foreach ($l in $txt) {
        if ($l -match '^\s+[^:]+?\s:\s(.+)$') {
            $n = $Matches[1].Trim()
            if ($n -and $n -notmatch '^<') { $known[$n] = $true }
        }
    }
    $known
}

function global:Get-WifiNetworks {
    $access = Await ([Windows.Devices.WiFi.WiFiAdapter]::RequestAccessAsync()) ([Windows.Devices.WiFi.WiFiAccessStatus])
    if ($access.ToString() -ne 'Allowed') { return [ordered]@{ ok = $false; reason = 'location' } }
    $a = Get-WifiAdapter
    if (-not $a) { return [ordered]@{ ok = $false; reason = 'noadapter' } }
    Safe { AwaitAction ($a.ScanAsync()) }
    $current = Safe { Get-WifiName }
    $known = Get-KnownWifi
    $best = @{}
    foreach ($n in $a.NetworkReport.AvailableNetworks) {
        if (-not $n.Ssid) { continue }
        if (-not $best.ContainsKey($n.Ssid) -or $best[$n.Ssid].SignalBars -lt $n.SignalBars) { $best[$n.Ssid] = $n }
    }
    $global:WifiNets = $best
    $list = foreach ($ssid in $best.Keys) {
        $n = $best[$ssid]
        $auth = $n.SecuritySettings.NetworkAuthenticationType.ToString()
        [ordered]@{
            ssid      = $ssid
            bars      = [int]$n.SignalBars
            secure    = -not ($auth -eq 'Open80211' -or $auth -eq 'None')
            known     = $known.ContainsKey($ssid)
            connected = $ssid -eq $current
        }
    }
    $sorted = @($list | Sort-Object -Property @{ Expression = { -not $_.connected } }, @{ Expression = { -not $_.known } }, @{ Expression = { -$_.bars } })
    [ordered]@{ ok = $true; items = $sorted }
}

function global:Connect-Wifi([string]$ssidB64, [string]$passB64) {
    $ssid = FromB64 $ssidB64
    $a = Get-WifiAdapter
    $n = $global:WifiNets[$ssid]
    if (-not $a -or -not $n) { return 'notfound' }
    $kind = [Windows.Devices.WiFi.WiFiReconnectionKind]::Automatic
    if ($passB64) {
        $cred = New-Object Windows.Security.Credentials.PasswordCredential
        $cred.Password = FromB64 $passB64
        $res = Await ($a.ConnectAsync($n, $kind, $cred)) ([Windows.Devices.WiFi.WiFiConnectionResult])
    } else {
        $res = Await ($a.ConnectAsync($n, $kind)) ([Windows.Devices.WiFi.WiFiConnectionResult])
    }
    $s = $res.ConnectionStatus.ToString()
    if ($s -eq 'Success') { 'ok' } else { $s }
}

function global:Disconnect-Wifi {
    $a = Get-WifiAdapter
    if ($a) { $a.Disconnect() }
    'ok'
}

# ---- Onglet Apps : applis du menu Démarrer ----
function global:Get-AppsList {
    $skip = '(?i)uninstall|désinstaller|readme|lisez-moi|documentation|help|aide$|website|site web|release notes'
    $items = @(Get-StartApps | Where-Object { $_.Name -and $_.Name -notmatch $skip } | Sort-Object Name | ForEach-Object { [ordered]@{ name = $_.Name; id = $_.AppID } })
    [ordered]@{ ok = $true; items = $items }
}

# ---- Onglet Fond d'écran ----
function global:Set-Wallpaper([string]$pathB64) {
    if ([HubNative.Win]::SetWallpaper((FromB64 $pathB64))) { 'ok' } else { 'error' }
}

function global:Get-Wallpaper {
    (Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop' -ErrorAction Stop).WallPaper
}

# ---- Onglet Énergie ----
function global:Invoke-Sleep {
    Add-Type -AssemblyName System.Windows.Forms
    $null = [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)
    'ok'
}

# ---- Etat complet envoyé à l'interface ----
function global:Get-HubState {
    $wifi = Safe { Get-Radio 'WiFi' }
    $bt = Safe { Get-Radio 'Bluetooth' }
    [ordered]@{
        wifi     = if ($wifi) { $wifi.State.ToString() -eq 'On' } else { $null }
        wifiName = Safe { Get-WifiName }
        bt       = if ($bt) { $bt.State.ToString() -eq 'On' } else { $null }
        volume   = Safe { [int][math]::Round([HubNative.Audio]::GetVolume() * 100) }
        mute     = Safe { [HubNative.Audio]::GetMute() }
        output   = Safe { [HubNative.Audio]::DeviceName() }
        dark     = Safe { Get-DarkMode }
        night    = Safe { Get-NightLight }
    }
}

# ---- Icône d'une appli du Microsoft Store (Deezer Store, Minecraft, Xbox...) ----
$global:AppxByFamily = $null
function global:Get-UwpIcon([string]$idB64) {
    $id = FromB64 $idB64
    $parts = $id.Split('!', 2)
    if (-not $global:AppxByFamily) {
        $global:AppxByFamily = @{}
        foreach ($p in (Get-AppxPackage -ErrorAction SilentlyContinue)) { $global:AppxByFamily[$p.PackageFamilyName] = $p }
    }
    $pkg = $global:AppxByFamily[$parts[0]]
    if (-not $pkg -or -not $pkg.InstallLocation) { return $null }
    [xml]$man = Get-Content -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml') -Raw -ErrorAction Stop
    $apps = @($man.Package.Applications.Application)
    $app = $apps | Where-Object { $_.Id -eq $parts[1] } | Select-Object -First 1
    if (-not $app) { $app = $apps[0] }
    $ve = $app.VisualElements
    $logo = $null
    foreach ($attr in 'Square44x44Logo', 'Square150x150Logo', 'Logo') { if ($ve -and $ve.$attr) { $logo = $ve.$attr; break } }
    if (-not $logo) { $logo = $man.Package.Properties.Logo }
    if (-not $logo) { return $null }
    $full = Join-Path $pkg.InstallLocation $logo
    $dir = Split-Path -Parent $full
    $base = [IO.Path]::GetFileNameWithoutExtension($full)
    $ext = [IO.Path]::GetExtension($full)
    # Windows range plusieurs tailles du logo : on prend celle qui ressemble à l'icône de la barre des tâches
    $rank = {
        $n = $_.Name.ToLower()
        if ($n -match 'targetsize-48_altform-unplated') { 0 } elseif ($n -match 'targetsize-48') { 1 }
        elseif ($n -match 'targetsize-64_altform-unplated') { 2 } elseif ($n -match 'targetsize-32') { 3 }
        elseif ($n -match 'scale-200') { 4 } elseif ($n -match 'scale-100') { 5 } else { 6 }
    }
    $pick = Get-ChildItem -LiteralPath $dir -Filter "$base*$ext" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'contrast' } | Sort-Object $rank | Select-Object -First 1
    if (-not $pick -and (Test-Path -LiteralPath $full)) { $pick = Get-Item -LiteralPath $full }
    if (-not $pick) { return $null }
    'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($pick.FullName))
}
