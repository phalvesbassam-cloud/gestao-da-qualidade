/**
 * QualiHub — Apps Script de gravação (QLD/QLDE e Organograma)
 * ------------------------------------------------------------
 * Como instalar (uma vez):
 *  1. Acesse https://script.google.com → "Novo projeto" (projeto separado;
 *     NÃO cole no script que já existe na planilha, senão os dois doPost brigam).
 *  2. Dê o nome "QualiHub - Gravação", apague o conteúdo padrão, cole TODO este
 *     código e salve.
 *  3. Implantar → Nova implantação → tipo "App da Web":
 *       Executar como: Eu
 *       Quem pode acessar: Qualquer pessoa
 *  4. Autorize, copie a URL que termina em /exec e configure no site como
 *     QUALIHUB_SCRIPT_URL (ou envie a URL para colocarmos no código).
 *
 * Se você alterar este código depois, use Implantar → Gerenciar implantações →
 * editar (lápis) → Versão: Nova versão, para manter a mesma URL.
 */

var SPREADSHEET_ID = "1ockGLmUaeC7u0QpwxROYo2rIz-40RnUC8oRGZwrq2Q0"; // IDF-ALERTA-RNC
var QLD_SHEET = "QLD-QLDE";
var ORG_SHEET = "ORGANOGRAMA";
var AUDIT_SHEET = "AUDITORIA";
var PHOTO_FOLDER = "QualiHub - Fotos do Organograma";
var ORG_CHUNK = 40000; // limite de 50 mil caracteres por célula

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "getOrg") return json_({ ok: true, org: readOrg_() });
  return json_({ ok: true, service: "QualiHub", time: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    switch (body.action) {
      case "updateQld":
        return json_(updateQld_(body));
      case "addQld":
        return json_(addQld_(body));
      case "setQldCheck":
        return json_(setQldCheck_(body));
      case "saveOrg":
        return json_(saveOrg_(body));
      case "uploadFoto":
        return json_(uploadFoto_(body));
      default:
        return json_({ ok: false, error: "Ação desconhecida: " + body.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ============================== QLD / QLDE ============================== */

function norm_(v) {
  return String(v == null ? "" : v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function qldSheet_() {
  var sh = ss_().getSheetByName(QLD_SHEET);
  if (!sh) throw new Error("Aba " + QLD_SHEET + " não encontrada.");
  return sh;
}

/** Mapa nome-normalizado → número da coluna (1-based). Cria colunas que faltarem. */
function qldColumns_(sh, ensure) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(norm_);
  function find(names) {
    for (var i = 0; i < headers.length; i++) {
      for (var j = 0; j < names.length; j++) {
        if (headers[i] === names[j]) return i + 1;
      }
    }
    for (var k = 0; k < headers.length; k++) {
      for (var m = 0; m < names.length; m++) {
        if (headers[k] && headers[k].indexOf(names[m]) >= 0) return k + 1;
      }
    }
    return 0;
  }
  var cols = {
    item: find(["item"]),
    qtdeBloqueada: find(["qtde. bloqueada", "qtde bloqueada"]),
    valorBloqueado: find(["valor bloqueado"]),
    qtdeLivre: find(["qtde. livre", "qtde livre"]),
    valorLivre: find(["valor livre"]),
    deposito: find(["deposito"]),
    motivo: find(["motivo"]),
    acao: find(["acao"]),
    check: find(["check"]),
    finalizadoEm: find(["finalizado em"]),
    finalizadoPor: find(["finalizado por"]),
  };
  var labels = { motivo: "Motivo", finalizadoEm: "Finalizado em", finalizadoPor: "Finalizado por" };
  (ensure || []).forEach(function (key) {
    if (!cols[key]) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(labels[key] || key);
      cols[key] = col;
    }
  });
  if (!cols.item || !cols.deposito) throw new Error("Colunas Item/Depósito não encontradas na aba " + QLD_SHEET + ".");
  return cols;
}

/** Encontra a linha do item: usa a linha sugerida se bater, senão procura por item + depósito. */
function findQldRow_(sh, cols, rowHint, item, deposito) {
  var last = sh.getLastRow();
  var wantItem = norm_(item);
  var wantDep = norm_(deposito);
  function matches(r) {
    if (r < 2 || r > last) return false;
    var it = norm_(sh.getRange(r, cols.item).getValue());
    var dep = norm_(sh.getRange(r, cols.deposito).getValue());
    return it === wantItem && (!wantDep || dep === wantDep);
  }
  if (rowHint && matches(Number(rowHint))) return Number(rowHint);
  var items = sh.getRange(2, cols.item, Math.max(last - 1, 1), 1).getValues();
  var deps = sh.getRange(2, cols.deposito, Math.max(last - 1, 1), 1).getValues();
  for (var i = 0; i < items.length; i++) {
    if (norm_(items[i][0]) === wantItem && (!wantDep || norm_(deps[i][0]) === wantDep)) return i + 2;
  }
  throw new Error("Item " + item + " (depósito " + deposito + ") não encontrado na planilha.");
}

var QLD_FIELDS = ["item", "qtdeBloqueada", "valorBloqueado", "qtdeLivre", "valorLivre", "deposito", "motivo", "acao"];
var QLD_NUMBERS = { qtdeBloqueada: true, valorBloqueado: true, qtdeLivre: true, valorLivre: true };

function writeFields_(sh, cols, row, fields) {
  var changed = {};
  QLD_FIELDS.forEach(function (key) {
    if (!(key in fields) || !cols[key]) return;
    var value = fields[key];
    if (QLD_NUMBERS[key]) value = Number(value) || 0;
    else value = String(value == null ? "" : value).trim();
    sh.getRange(row, cols[key]).setValue(value);
    changed[key] = value;
  });
  return changed;
}

function updateQld_(b) {
  var sh = qldSheet_();
  var cols = qldColumns_(sh, ["motivo"]);
  var row = findQldRow_(sh, cols, b.row, b.item, b.deposito);
  var changed = writeFields_(sh, cols, row, b.fields || {});
  audit_(b.autor, "qld_editado", "qld_qlde", b.item + "/" + b.deposito, b.item, changed);
  return { ok: true, row: row };
}

function addQld_(b) {
  var sh = qldSheet_();
  var cols = qldColumns_(sh, ["motivo"]);
  var f = b.fields || {};
  if (!String(f.item || "").trim()) throw new Error("Informe o item.");
  if (!String(f.deposito || "").trim()) throw new Error("Informe o depósito.");
  var row = sh.getLastRow() + 1;
  var changed = writeFields_(sh, cols, row, f);
  if (cols.check) sh.getRange(row, cols.check).insertCheckboxes().setValue(false);
  audit_(b.autor, "qld_adicionado", "qld_qlde", f.item + "/" + f.deposito, f.item, changed);
  return { ok: true, row: row };
}

function setQldCheck_(b) {
  var sh = qldSheet_();
  var cols = qldColumns_(sh, ["finalizadoEm", "finalizadoPor"]);
  if (!cols.check) throw new Error("Coluna Check não encontrada.");
  var row = findQldRow_(sh, cols, b.row, b.item, b.deposito);
  var checked = Boolean(b.checked);
  sh.getRange(row, cols.check).setValue(checked);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  sh.getRange(row, cols.finalizadoEm).setValue(checked ? now : "");
  sh.getRange(row, cols.finalizadoPor).setValue(checked ? String(b.autor || "") : "");
  audit_(b.autor, checked ? "qld_finalizado" : "qld_reaberto", "qld_qlde", b.item + "/" + b.deposito, b.item, {
    checked: checked,
  });
  return { ok: true, row: row, finalizadoEm: checked ? now : "" };
}

/* ============================== ORGANOGRAMA ============================== */

function orgSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(ORG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ORG_SHEET);
    sh.getRange(1, 1).setValue("json");
  }
  return sh;
}

function readOrg_() {
  var sh = orgSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var parts = sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) {
    return String(r[0] || "");
  });
  var text = parts.join("");
  return text ? JSON.parse(text) : null;
}

function saveOrg_(b) {
  if (!b.org || !b.org.pessoas) throw new Error("Organograma inválido.");
  var sh = orgSheet_();
  var org = b.org;
  org.atualizadoEm = new Date().toISOString();
  org.atualizadoPor = String(b.autor || "");
  var text = JSON.stringify(org);
  var chunks = [];
  for (var i = 0; i < text.length; i += ORG_CHUNK) chunks.push([text.substring(i, i + ORG_CHUNK)]);
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 1).clearContent();
  sh.getRange(1, 1).setValue("json");
  // Força texto puro (sem conversão de números/datas).
  sh.getRange(2, 1, chunks.length, 1).setNumberFormat("@").setValues(chunks);
  audit_(b.autor, "organograma_atualizado", "organograma", "global", "", { pessoas: org.pessoas.length });
  return { ok: true, atualizadoEm: org.atualizadoEm };
}

function uploadFoto_(b) {
  if (!b.base64) throw new Error("Foto vazia.");
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  var bytes = Utilities.base64Decode(String(b.base64).replace(/^data:[^,]+,/, ""));
  var blob = Utilities.newBlob(bytes, b.mime || "image/jpeg", (b.nome || "foto") + ".jpg");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, fileId: file.getId() };
}

/* ============================== UTILITÁRIOS ============================== */

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function audit_(autor, acao, entidade, entidadeId, item, dados) {
  try {
    var sh = ss_().getSheetByName(AUDIT_SHEET);
    if (!sh) return;
    sh.appendRow([
      Utilities.getUuid(),
      new Date().toISOString(),
      String(autor || "Sistema"),
      acao,
      entidade,
      entidadeId || "",
      "",
      item || "",
      JSON.stringify(dados || {}),
    ]);
  } catch (e) {
    // a auditoria nunca bloqueia a gravação
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
