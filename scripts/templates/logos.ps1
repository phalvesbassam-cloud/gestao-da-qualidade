# Gera as versões da logo usadas nos modelos (recortada e em branco para fundos escuros).
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$origem = Join-Path $raiz "..\..\src\assets\frasle-logo.png"
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $origem))

# Limites do desenho (alpha > 20)
$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    $p = $src.GetPixel($x, $y)
    if ($p.A -gt 20 -and -not ($p.R -gt 235 -and $p.G -gt 235 -and $p.B -gt 235)) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$w = $maxX - $minX + 1; $h = $maxY - $minY + 1
$cor = New-Object System.Drawing.Bitmap $w, $h
$branca = New-Object System.Drawing.Bitmap $w, $h
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $src.GetPixel($x + $minX, $y + $minY)
    $quaseBranco = ($p.R -gt 235 -and $p.G -gt 235 -and $p.B -gt 235)
    if ($p.A -lt 5 -or $quaseBranco) {
      $cor.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
      $branca.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
      continue
    }
    $cor.SetPixel($x, $y, $p)
    $vermelho = ($p.R - [Math]::Max($p.G, $p.B)) -gt 60
    if ($vermelho) { $branca.SetPixel($x, $y, $p) }
    else {
      # cinza escuro -> branco, preservando a suavização pela luminosidade
      $lum = ($p.R + $p.G + $p.B) / 3
      $a = [int]([Math]::Min(255, $p.A * [Math]::Min(1, (255 - $lum) / 150)))
      $branca.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, 255, 255, 255))
    }
  }
}
# Reduz para 640 px de largura (nitidez suficiente no slide e arquivos .pptx leves)
function Salvar($img, $nome) {
  $lw = 640; $lh = [int]($img.Height * $lw / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap $lw, $lh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = "HighQualityBicubic"; $g.SmoothingMode = "HighQuality"; $g.PixelOffsetMode = "HighQuality"
  $g.DrawImage($img, 0, 0, $lw, $lh); $g.Dispose()
  $bmp.Save((Join-Path $raiz "..\..\src\assets\templates\$nome"), [System.Drawing.Imaging.ImageFormat]::Png)
}
Salvar $cor "logo-frasle.png"
Salvar $branca "logo-frasle-branca.png"
"$w x $h"
