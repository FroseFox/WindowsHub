# Boucle de surveillance : vérifie la musique, l'état du système, le plein écran et le presse-papier,
# et n'envoie à Electron QUE ce qui a changé. Les intervalles s'allongent quand le panneau est fermé ou en jeu.

$global:SW = [Diagnostics.Stopwatch]::StartNew()
$global:W = @{
    mode = 'closed'; sys = ''; media = ''; fs = $null; clip = [uint32]0
    est = $null; estAt = 0; wait = 300; errors = 0
    next = @{ media = 0; sys = 0; fs = 0; clip = 0; notif = 0 }
}
# en millisecondes
$global:Intervals = @{
    open   = @{ media = 300;  sys = 500;  fs = 1000; clip = 500;  notif = 1500 }
    closed = @{ media = 400;  sys = 2000; fs = 1000; clip = 700;  notif = 1500 }
    game   = @{ media = 1500; sys = 8000; fs = 400;  clip = 2500; notif = 4000 }
}

function global:Set-WatchMode([string]$m) {
    if ($global:Intervals.ContainsKey($m)) {
        $global:W.mode = $m
        $global:W.next.sys = 0
        $global:W.next.media = 0
    }
    'ok'
}

# Renvoie tout l'état (quand l'interface vient de se recharger)
function global:Force-Emit {
    $global:W.sys = ''; $global:W.media = ''; $global:W.fs = $null
    $global:W.next.sys = 0; $global:W.next.media = 0; $global:W.next.fs = 0
    'ok'
}

function global:Watch-Error([string]$what, $err) {
    $global:W.errors++
    if ($global:W.errors -le 5) { [Console]::Error.WriteLine("$what : " + $err.Exception.Message) }
}

function global:Watch-Media {
    $m = Get-MediaCore
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $sig = "$($m.active)|$($m.title)|$($m.artist)|$($m.status)|$($m.duration)|$($m.app)"
    # position estimée maintenant : sert à repérer un saut (quand tu avances dans le morceau)
    $est = $null
    if ($m.active) {
        $est = [double]$m.position
        if ($m.status -eq 'Playing' -and $m.updated -gt 0 -and ($now - $m.updated) -lt 21600000) { $est += ($now - $m.updated) }
    }
    $jump = $false
    if ($null -ne $est -and $null -ne $global:W.est) {
        $pred = $global:W.est
        if ($m.status -eq 'Playing') { $pred += ($now - $global:W.estAt) }
        if ([Math]::Abs($est - $pred) -gt 2500) { $jump = $true }
    }
    $global:W.est = $est
    $global:W.estAt = $now
    if ($sig -ne $global:W.media -or $m.thumbChanged -or $jump) {
        $global:W.media = $sig
        $m.type = 'media'
        Emit ('@E ' + (ConvertTo-Json -InputObject $m -Compress -Depth 4))
    }
}

function global:Watch-Sys {
    $j = ConvertTo-Json -InputObject (Get-HubState) -Compress
    if ($j -ne $global:W.sys) {
        $global:W.sys = $j
        Emit ('@E {"type":"sys","data":' + $j + '}')
    }
}

# ---- Détection des jeux (et pas juste du plein écran) ----
# Dossiers typiques des jeux (launchers)
$global:GameDirs = @('\steamapps\common\', '\riot games\', '\epic games\', '\xboxgames\', '\ea games\', '\ubisoft game launcher\games\',
    '\gog galaxy\games\', '\gog games\', '\rockstar games\', '\battle.net\games\', '\roblox\versions\', '\windowsapps\microsoft.minecraft')
# Programmes connus comme jeux même ailleurs
$global:KnownGames = @('valorant-win64-shipping.exe', 'robloxplayerbeta.exe', 'minecraft.windows.exe', 'league of legends.exe', 'r5apex.exe',
    'cs2.exe', 'fortniteclient-win64-shipping.exe', 'overwatch.exe', 'rocketleague.exe', 'gta5.exe', 'eldenring.exe')
# Jamais des jeux : navigateurs, launchers, outils...
$global:NeverGames = '^(chrome|msedge|firefox|opera|opera_gx|brave|vivaldi|arc|discord|obs64|obs32|spotify|deezer|explorer|code|devenv|steam|steamwebhelper|epicgameslauncher|battle\.net|eadesktop|origin|upc|ubisoftconnect|galaxyclient|robloxstudiobeta|riotclient.*|leagueclient.*|vgtray|crashreport.*|unitycrashhandler.*|electron|hub|vlc|mpc-hc.*|powerpnt|winword|excel|figma|photoshop|premiere.*|afterfx|resolve|blender)\.exe$'

$global:GameExtra = New-Object 'System.Collections.Generic.HashSet[string]'   # « c'est un jeu » (choix perso)
$global:GameNever = New-Object 'System.Collections.Generic.HashSet[string]'   # « ce n'est pas un jeu » (choix perso)
$global:GameCache = @{}
$global:GameStore = New-Object 'System.Collections.Generic.HashSet[string]'
$global:GameStoreAt = -999999

# Liste des jeux que Windows a lui-même reconnus (Game Bar / mode Jeu)
function global:Load-GameStore {
    $set = New-Object 'System.Collections.Generic.HashSet[string]'
    try {
        $root = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('System\GameConfigStore\Children')
        if ($root) {
            foreach ($n in $root.GetSubKeyNames()) {
                $k = $root.OpenSubKey($n)
                if (-not $k) { continue }
                $p = $k.GetValue('MatchedExeFullPath')
                if ($p) { $null = $set.Add(([string]$p).ToLower()) }
                $k.Close()
            }
            $root.Close()
        }
    } catch { }
    $global:GameStore = $set
    $global:GameStoreAt = $global:SW.ElapsedMilliseconds
    $global:GameCache = @{}
}

# Choix perso envoyés par Electron : noms d'exe séparés par |
function global:Set-GameLists([string]$yesB64, [string]$noB64) {
    $global:GameExtra.Clear(); $global:GameNever.Clear()
    foreach ($n in (FromB64 $yesB64).Split('|')) { if ($n) { $null = $global:GameExtra.Add($n.ToLower()) } }
    foreach ($n in (FromB64 $noB64).Split('|')) { if ($n) { $null = $global:GameNever.Add($n.ToLower()) } }
    $global:W.fs = $null
    'ok'
}

function global:ExeName([string]$path) { $path.Substring($path.LastIndexOfAny([char[]]'\/') + 1) }

function global:Is-GameExe([string]$path) {
    $p = $path.ToLower()
    $name = ExeName $p
    if ($global:GameNever.Contains($name)) { return $false }
    if ($global:GameExtra.Contains($name)) { return $true }
    if ($global:GameCache.ContainsKey($p)) { return $global:GameCache[$p] }
    $r = $false
    if ($name -match $global:NeverGames) { $r = $false }
    elseif ($global:KnownGames -contains $name) { $r = $true }
    elseif ($global:GameStore.Contains($p)) { $r = $true }
    else { foreach ($d in $global:GameDirs) { if ($p.Contains($d)) { $r = $true; break } } }
    $global:GameCache[$p] = $r
    $r
}

function global:Watch-Fs {
    if ($global:SW.ElapsedMilliseconds - $global:GameStoreAt -gt 600000) { Load-GameStore }
    $exe = [HubWatch.Screen]::ForegroundExe()
    $game = $false
    if ($exe) { $game = Is-GameExe $exe }
    $name = if ($exe) { ExeName $exe } else { '' }
    # jeu en plein écran exclusif pas reconnu autrement (sauf si tu as dit que ce n'est pas un jeu)
    if (-not $game -and -not $global:GameNever.Contains($name.ToLower()) -and [HubWatch.Screen]::NotificationState() -eq 3) { $game = $true }
    # en jeu : on regarde aussi si la souris est visible (menus) ou cachée (en pleine partie)
    $cursor = $true
    if ($game) { $cursor = [bool](Safe { [HubWatch.Screen]::CursorVisible() }) }
    $sig = "$game|$name|$cursor"
    if ($sig -ne $global:W.fs) {
        $global:W.fs = $sig
        Emit ('@E ' + (ConvertTo-Json -Compress -InputObject ([ordered]@{ type = 'game'; game = [bool]$game; exe = $name; cursor = $cursor })))
    }
}

function global:Watch-Clip {
    $q = [HubNative.Win]::ClipboardSeq()
    if ($q -ne $global:W.clip) {
        $first = ($global:W.clip -eq 0)
        $global:W.clip = $q
        if (-not $first) { Emit '@E {"type":"clip"}' }
    }
}

# ---- Notifications Windows (Discord, mails, etc.) ----
$null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime]
$global:Notif = @{ listener = $null; status = 'off'; enabled = $false; first = $true; icons = @{}
    seen = (New-Object 'System.Collections.Generic.HashSet[uint32]') }

# Active / coupe la lecture. Renvoie l'état d'accès : Allowed, Denied, Unspecified ou une erreur.
function global:Set-Notif([bool]$on) {
    $global:Notif.enabled = $on
    if (-not $on) { return 'off' }
    if ($global:Notif.status -ne 'Allowed') {
        try {
            $l = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
            $st = Await ($l.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
            $global:Notif.listener = $l
            $global:Notif.status = $st.ToString()
            $global:Notif.first = $true
        } catch { $global:Notif.status = 'error: ' + $_.Exception.Message }
    }
    $global:Notif.status
}

function global:Get-NotifIcon($n, [string]$key) {
    if ($global:Notif.icons.ContainsKey($key)) { return $global:Notif.icons[$key] }
    $data = Safe { Read-Thumb ($n.AppInfo.DisplayInfo.GetLogo((New-Object Windows.Foundation.Size 48, 48))) }
    $global:Notif.icons[$key] = $data
    $data
}

function global:Watch-Notif {
    if (-not $global:Notif.enabled -or $global:Notif.status -ne 'Allowed') { return }
    $list = Await ($global:Notif.listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
    $first = $global:Notif.first
    $global:Notif.first = $false
    if ($global:Notif.seen.Count -gt 3000) { $global:Notif.seen.Clear(); $first = $true }
    foreach ($n in $list) {
        if (-not $global:Notif.seen.Add([uint32]$n.Id)) { continue }
        if ($first) { continue }   # au démarrage : on ignore celles déjà présentes
        $texts = @()
        try {
            $b = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
            if ($b) { $texts = @($b.GetTextElements() | ForEach-Object { $_.Text } | Where-Object { $_ }) }
        } catch { }
        $app = Safe { $n.AppInfo.DisplayInfo.DisplayName }
        $key = Safe { $n.AppInfo.AppUserModelId }
        if (-not $key) { $key = $app }
        $icon = if ($key) { Get-NotifIcon $n $key } else { $null }
        Emit ('@E ' + (ConvertTo-Json -Compress -InputObject ([ordered]@{
            type = 'notif'; app = $app
            title = $(if ($texts.Count) { $texts[0] } else { $app })
            body = (($texts | Select-Object -Skip 1) -join ' · ')
            icon = $icon
        })))
    }
}

function global:Watch-Tick {
    $iv = $global:Intervals[$global:W.mode]
    $n = $global:W.next
    $now = $global:SW.ElapsedMilliseconds
    if ($now -ge $n.media) { try { Watch-Media } catch { Watch-Error 'musique' $_ }; $n.media = $global:SW.ElapsedMilliseconds + $iv.media }
    if ($now -ge $n.fs)    { try { Watch-Fs }    catch { Watch-Error 'plein écran' $_ }; $n.fs = $now + $iv.fs }
    if ($now -ge $n.clip)  { try { Watch-Clip }  catch { Watch-Error 'presse-papier' $_ }; $n.clip = $now + $iv.clip }
    if ($now -ge $n.sys)   { try { Watch-Sys }   catch { Watch-Error 'système' $_ }; $n.sys = $global:SW.ElapsedMilliseconds + $iv.sys }
    if ($now -ge $n.notif) { try { Watch-Notif } catch { Watch-Error 'notifications' $_ }; $n.notif = $global:SW.ElapsedMilliseconds + $iv.notif }
    $soonest = [Math]::Min([Math]::Min([Math]::Min($n.media, $n.fs), [Math]::Min($n.clip, $n.sys)), $n.notif)
    $global:W.wait = [int][Math]::Max(25, [Math]::Min(2000, $soonest - $global:SW.ElapsedMilliseconds))
}
