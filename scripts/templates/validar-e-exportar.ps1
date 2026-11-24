# Abre cada .pptx no Microsoft PowerPoint (prova de que o arquivo é válido),
# confere o conteúdo editável e exporta as imagens de pré-visualização a partir
# do próprio arquivo — assim a prévia do site é exatamente o que será baixado.
param(
  [string]$Pasta = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\public\templates"),
  [int]$Largura = 1280,
  [switch]$SemImagens
)
$ErrorActionPreference = "Stop"
$Pasta = (Resolve-Path $Pasta).Path
$app = New-Object -ComObject PowerPoint.Application
$relatorio = @()
try {
  foreach ($arq in Get-ChildItem $Pasta -Filter *.pptx | Sort-Object Name) {
    $id = [IO.Path]::GetFileNameWithoutExtension($arq.Name)
    # ReadOnly, Untitled, WithWindow=false
    $pres = $app.Presentations.Open($arq.FullName, -1, 0, 0)
    $graficos = 0; $tabelas = 0; $formas = 0; $textos = 0; $imagens = 0; $placeholders = 0
    foreach ($s in $pres.Slides) {
      foreach ($sh in $s.Shapes) {
        $formas++
        if ($sh.HasChart -eq -1) { $graficos++ }
        if ($sh.HasTable -eq -1) { $tabelas++ }
        if ($sh.HasTextFrame -eq -1 -and $sh.TextFrame.HasText -eq -1) { $textos++ }
        if ($sh.Type -eq 13) { $imagens++ }
        if ($sh.Type -eq 14) { $placeholders++ }
      }
    }
    $w = $pres.PageSetup.SlideWidth; $h = $pres.PageSetup.SlideHeight
    if (-not $SemImagens) {
      $dir = Join-Path $Pasta $id
      if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
      New-Item -ItemType Directory $dir | Out-Null
      $alt = [int]($Largura * $h / $w)
      $i = 0
      foreach ($s in $pres.Slides) {
        $i++
        $s.Export((Join-Path $dir ("slide-{0:D2}.jpg" -f $i)), "JPG", $Largura, $alt)
      }
    }
    $relatorio += [pscustomobject]@{
      modelo = $id; slides = $pres.Slides.Count; proporcao = [Math]::Round($w / $h, 3)
      formas = $formas; textos = $textos; graficos = $graficos; tabelas = $tabelas
      imagens = $imagens; placeholders = $placeholders
    }
    $pres.Close()
  }
} finally {
  # Só fecha o PowerPoint se não houver outras apresentações abertas pela pessoa.
  try { if ($app.Presentations.Count -eq 0) { $app.Quit() } } catch {}
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
$relatorio | Format-Table -AutoSize | Out-String -Width 200
