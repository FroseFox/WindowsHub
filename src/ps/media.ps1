# Lecteur média : lit le morceau en cours (Spotify, navigateur, etc.) via les contrôles média de Windows.

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$global:AsStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [Type[]]@([Windows.Storage.Streams.IInputStream]))
$global:MediaMgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$global:ThumbKey = $null
$global:ThumbTries = 0

# Détection d'un jeu / d'une appli en plein écran sur l'écran principal
Add-CachedType 'HubWatch' (Get-NativeSource 'HubWatch')

function global:Get-CursorVisible { [HubWatch.Screen]::CursorVisible() }

function global:Read-Thumb($ref) {
    $stream = Await ($ref.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $type = if ($stream.ContentType) { $stream.ContentType } else { 'image/jpeg' }
    $bytes = $null
    $tries = @(
        # PowerShell 5 ne « voit » pas l'interface du flux : on passe par la réflexion (comme pour Await)
        { $net = $global:AsStreamForRead.Invoke($null, @($stream)); $ms = New-Object System.IO.MemoryStream; $net.CopyTo($ms); $net.Dispose(); , $ms.ToArray() },
        { $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream); $ms = New-Object System.IO.MemoryStream; $net.CopyTo($ms); $ms.ToArray() },
        { $size = [uint32]$stream.Size; $reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0)); $null = Await ($reader.LoadAsync($size)) ([uint32]); $b = New-Object byte[] $size; $reader.ReadBytes($b); , $b },
        { $size = [uint32]$stream.Size; $reader = [Windows.Storage.Streams.DataReader]::new($stream); $null = Await ($reader.LoadAsync($size)) ([uint32]); $b = New-Object byte[] $size; $reader.ReadBytes($b); , $b }
    )
    $errs = @()
    foreach ($t in $tries) {
        try { $bytes = [byte[]](& $t); if ($bytes -and $bytes.Length -gt 0) { break } } catch { $errs += $_.Exception.Message }
    }
    # une seule ligne dans le journal, et seulement si aucune méthode n'a marché
    if ((-not $bytes -or $bytes.Length -eq 0) -and $errs.Count) { [Console]::Error.WriteLine("pochette Windows illisible : " + $errs[0]) }
    if (-not $bytes -or $bytes.Length -eq 0) { return $null }
    "data:$type;base64," + [Convert]::ToBase64String($bytes)
}

function global:Get-MediaCore {
    $s = $global:MediaMgr.GetCurrentSession()
    if (-not $s) {
        $changed = $null -ne $global:ThumbKey
        $global:ThumbKey = $null
        return [ordered]@{ active = $false; thumbChanged = $changed; thumb = $null }
    }
    $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $t = $s.GetTimelineProperties()
    $pb = $s.GetPlaybackInfo()

    $out = [ordered]@{
        active      = $true
        title       = $p.Title
        artist      = if ($p.Artist) { $p.Artist } else { $p.AlbumArtist }
        app         = $s.SourceAppUserModelId
        status      = $pb.PlaybackStatus.ToString()
        position    = [math]::Round($t.Position.TotalMilliseconds)
        duration    = [math]::Round(($t.EndTime - $t.StartTime).TotalMilliseconds)
        updated     = $t.LastUpdatedTime.ToUnixTimeMilliseconds()
        now         = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        thumbChanged = $false
    }

    # La pochette n'est envoyée que quand le morceau change (Spotify la publie parfois un peu après le titre).
    $key = "$($p.Title)|$($out.artist)"
    if ($key -ne $global:ThumbKey) {
        $global:ThumbKey = $key
        $global:ThumbTries = 0
        $out.thumbChanged = $true
        $out.thumb = $null
    }
    if ($global:ThumbTries -ge 0 -and $global:ThumbTries -lt 12) {
        $global:ThumbTries++
        if ($p.Thumbnail) {
            $img = Safe { Read-Thumb $p.Thumbnail }
            if ($img) {
                $out.thumb = $img
                $out.thumbChanged = $true
                $global:ThumbTries = -1
            }
        }
    }
    $out
}

function global:Get-Media {
    $o = Get-MediaCore
    $o.fs = Safe { [HubWatch.Screen]::FullscreenApp() }
    $o
}

function global:Invoke-Media([string]$cmd, [double]$arg) {
    $s = $global:MediaMgr.GetCurrentSession()
    if (-not $s) { return $false }
    switch ($cmd) {
        'toggle' { Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
        'next'   { Await ($s.TrySkipNextAsync()) ([bool]) }
        'prev'   { Await ($s.TrySkipPreviousAsync()) ([bool]) }
        'seek'   { Await ($s.TryChangePlaybackPositionAsync([long]($arg * 10000))) ([bool]) }
        default  { $false }
    }
}
