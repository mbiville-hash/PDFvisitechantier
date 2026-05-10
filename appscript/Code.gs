const CONFIG = {
  notionVersion: '2022-06-28',
  pdfCoEndpoint: 'https://api.pdf.co/v1/pdf/convert/from/html',
  pdfMargins: '10mm 10mm 10mm 10mm',
  pdfPaperSize: 'A4',
  fallbackDriveFolderId: '',
  reportsParentFolderId: '',
};

function doPost(e) {
  try {
    const payload = parseRequest_(e);
    validateWebhookSecret_(e, payload);

    if (payload.action === 'loadDraft') {
      return jsonResponse_({ ok: true, draft: loadDraft_(payload.id) });
    }

    if (payload.action === 'saveDraft') {
      return jsonResponse_({ ok: true, draft: saveDraft_(payload.draft, payload.summary) });
    }

    if (payload.action === 'generatePdf') {
      return jsonResponse_({ ok: true, draft: generatePdf_(payload.draft, payload.summary) });
    }

    throw new Error(`Action inconnue: ${payload.action}`);
  } catch (error) {
    console.error(error.stack || error);
    return jsonResponse_({ ok: false, error: error.message });
  }
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Requete vide.');
  return JSON.parse(e.postData.contents);
}

function validateWebhookSecret_(e, payload) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!expectedSecret) return;

  const querySecret = e && e.parameter && e.parameter.secret;
  const payloadSecret = payload && payload.webhook_secret;
  if (querySecret !== expectedSecret && payloadSecret !== expectedSecret) {
    throw new Error('Secret webhook invalide.');
  }
}

function saveDraft_(draft, summary) {
  validateDraft_(draft);

  const now = new Date().toISOString();
  const cleanDraft = JSON.parse(JSON.stringify(draft));
  cleanDraft.updatedAt = now;
  cleanDraft.summary = summary || cleanDraft.summary || {};
  cleanDraft.editableUrl = cleanDraft.editableUrl || buildEditableUrl_(cleanDraft.id);

  const folder = resolveChiffrageFolder_(cleanDraft);
  const file = upsertTextFile_(folder, draftFileName_(cleanDraft.id), JSON.stringify(cleanDraft, null, 2), MimeType.PLAIN_TEXT);

  cleanDraft.draftFileId = file.getId();
  cleanDraft.draftFileUrl = file.getUrl();
  upsertTextFile_(folder, draftFileName_(cleanDraft.id), JSON.stringify(cleanDraft, null, 2), MimeType.PLAIN_TEXT);

  return cleanDraft;
}

function generatePdf_(draft, summary) {
  const saved = saveDraft_(draft, summary);
  const folder = resolveChiffrageFolder_(saved);
  const apiKey = getRequiredProperty_('PDFCO_API_KEY');
  const html = buildBriefHtml_(saved, summary || saved.summary || {});
  const pdfBlob = createPdfWithPdfCo_(html, saved, apiKey);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  const client = sanitizeFilename_(getClientName_(saved) || 'client');
  const filename = `Brief-sous-traitant-${client}-${stamp}.pdf`;
  const file = folder.createFile(pdfBlob.setName(filename));

  saved.pdfUrl = file.getUrl();
  saved.pdfFileId = file.getId();
  saved.lastPdfGeneratedAt = new Date().toISOString();
  saved.status = 'pdf_generated';
  saved.summary = summary || saved.summary || {};

  upsertTextFile_(folder, draftFileName_(saved.id), JSON.stringify(saved, null, 2), MimeType.PLAIN_TEXT);
  return saved;
}

function loadDraft_(id) {
  if (!id) throw new Error('ID de fiche manquant.');
  const files = DriveApp.getFilesByName(draftFileName_(id));
  if (!files.hasNext()) throw new Error(`Fiche introuvable: ${id}`);
  const file = files.next();
  return JSON.parse(file.getBlob().getDataAsString());
}

function validateDraft_(draft) {
  if (!draft || !draft.id) throw new Error('Brouillon invalide: id manquant.');
  const identification = draft.formData && draft.formData.identification;
  if (!identification) throw new Error('Brouillon invalide: identification manquante.');

  const missing = [];
  if (!identification.clientName) missing.push('clientName');
  if (!identification.siteAddress) missing.push('siteAddress');
  if (!identification.visitDate) missing.push('visitDate');
  if (missing.length) throw new Error(`Champs minimum manquants: ${missing.join(', ')}`);
}

function resolveChiffrageFolder_(draft) {
  const affaireFolder = resolveAffaireFolder_(draft);
  return getOrCreateChildFolder_(affaireFolder, 'Chiffrage');
}

function resolveAffaireFolder_(draft) {
  const notionToken = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
  const fallbackFolderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FALLBACK_FOLDER_ID') || CONFIG.fallbackDriveFolderId;

  if (!draft.notionAffaireId) {
    if (!fallbackFolderId) throw new Error('Aucune affaire Notion et DRIVE_FALLBACK_FOLDER_ID manquant.');
    return DriveApp.getFolderById(fallbackFolderId);
  }

  if (!notionToken) throw new Error('NOTION_TOKEN manquant.');

  const affaire = getNotionPage_(draft.notionAffaireId, notionToken);
  const existingFolderId = extractDriveFolderId_(getPropertyText_(affaire, 'Dossier Drive'));
  if (existingFolderId) return DriveApp.getFolderById(existingFolderId);

  const parentId =
    PropertiesService.getScriptProperties().getProperty('REPORTS_PARENT_FOLDER_ID') ||
    PropertiesService.getScriptProperties().getProperty('DRIVE_PARENT_FOLDER_ID') ||
    CONFIG.reportsParentFolderId ||
    fallbackFolderId;

  if (!parentId) throw new Error('Dossier Drive absent dans Notion et REPORTS_PARENT_FOLDER_ID manquant.');

  const parent = DriveApp.getFolderById(parentId);
  const folderName = buildAffaireFolderName_(draft, affaire);
  const folder = parent.createFolder(folderName);
  updateNotionUrlProperty_(draft.notionAffaireId, 'Dossier Drive', folder.getUrl(), notionToken);
  return folder;
}

function getOrCreateChildFolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function upsertTextFile_(folder, filename, content, mimeType) {
  const files = folder.getFilesByName(filename);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return file;
  }

  return folder.createFile(filename, content, mimeType);
}

function draftFileName_(id) {
  return `fiche-visite-${id}.json`;
}

function buildEditableUrl_(id) {
  const base = PropertiesService.getScriptProperties().getProperty('FRONTEND_BASE_URL') || '';
  return base ? `${base.replace(/\/$/, '')}/?id=${encodeURIComponent(id)}` : '';
}

function createPdfWithPdfCo_(html, draft, apiKey) {
  const response = UrlFetchApp.fetch(CONFIG.pdfCoEndpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey },
    payload: JSON.stringify({
      html,
      name: `Brief-${draft.id}.pdf`,
      margins: CONFIG.pdfMargins,
      paperSize: CONFIG.pdfPaperSize,
      async: false,
    }),
    muteHttpExceptions: true,
  });

  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300 || body.error) {
    throw new Error(`Erreur PDF.co: ${body.message || response.getContentText()}`);
  }
  if (!body.url) throw new Error('PDF.co n a pas retourne d URL de PDF.');

  const pdfResponse = UrlFetchApp.fetch(body.url, { method: 'get', muteHttpExceptions: true });
  if (pdfResponse.getResponseCode() >= 300) {
    throw new Error(`Telechargement PDF impossible: ${pdfResponse.getResponseCode()}`);
  }

  return pdfResponse.getBlob().setContentType('application/pdf');
}

function buildBriefHtml_(draft, summary) {
  const data = draft.formData || {};
  const id = data.identification || {};
  const photos = draft.photos || {};
  const materials = data.materials || [];

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--dark:#111110;--gold:#b8975a;--paper:#f7f5f0;--white:#fff;--ink:#1a1a18;--border:rgba(184,151,90,.3);--soft:rgba(26,26,24,.58)}
body{background:var(--paper);font-family:Montserrat,sans-serif;color:var(--ink);font-size:11px;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;margin:0 auto;background:var(--paper)}
.header{background:var(--dark);padding:28px 38px;display:flex;justify-content:space-between;align-items:flex-start;color:#fff}
.brand{font-family:'Bodoni Moda',serif;font-size:18px;font-weight:700;letter-spacing:.04em}.brand span{color:var(--gold)}
.sub{font-size:8px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-top:5px}
.doc{text-align:right}.doc-title{font-family:'Bodoni Moda',serif;color:var(--gold);font-size:13px;line-height:1.2}.doc-ref{font-size:8px;letter-spacing:.14em;color:rgba(255,255,255,.45);margin-top:8px}
.bar{height:2px;background:var(--gold)}.body{padding:28px 38px 34px}.meta{display:grid;grid-template-columns:1fr 1fr;border:.5px solid var(--border);margin-bottom:24px}
.cell{padding:10px 13px;border-right:.5px solid var(--border);border-bottom:.5px solid var(--border)}.cell:nth-child(even){border-right:0}
.label{font-size:7px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:3px}.value{font-size:11px;font-weight:500}
.section{margin-bottom:18px;break-inside:avoid}.section-title{font-size:8px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);padding-bottom:6px;border-bottom:.5px solid var(--border);margin-bottom:9px}
.box{background:var(--white);border-left:2px solid var(--gold);padding:11px 13px;white-space:pre-wrap}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.photo{border:.5px solid var(--border);background:#e8e5df;min-height:95px}.photo img{width:100%;height:95px;object-fit:cover;display:block}.photo-caption{font-size:8px;color:var(--soft);padding:4px 6px}
.pill{display:inline-block;border:1px solid var(--border);color:var(--gold);padding:4px 8px;margin:2px 4px 2px 0;font-size:8px;text-transform:uppercase;letter-spacing:.08em}
.footer{background:var(--dark);color:rgba(255,255,255,.4);padding:12px 38px;font-size:8px;display:flex;justify-content:space-between}.footer b{color:var(--gold)}
</style></head><body><div class="page">
<div class="header"><div><div class="brand">FORTIS RÉNOVATION<span>.</span></div><div class="sub">Brief technique sous-traitant</div></div><div class="doc"><div class="doc-title">Brief technique sous-traitant<br/>Salle de bain</div><div class="doc-ref">${escapeHtml_(id.affNumber || draft.id)}</div></div></div>
<div class="bar"></div><div class="body">
<div class="meta">
${metaCell_('Client', id.clientName)}
${metaCell_('Date visite', id.visitDate)}
${metaCell_('Adresse chantier', id.siteAddress)}
${metaCell_('Commercial', id.commercial)}
${metaCell_('Type de visite', id.visitType)}
${metaCell_('Complétude', draft.completenessStatus)}
</div>
${section_('Résumé du projet', summary.projectSummary)}
${section_('Accès chantier', objectLines_(data.access))}
${section_('État existant', objectLines_(data.existing))}
${section_('Cotes principales', objectLines_(data.measurements))}
<div class="section"><div class="section-title">Photos clés</div><div class="photo-grid">${photoGrid_(photos)}</div></div>
${section_('Structure / supports', objectLines_(data.structure))}
${section_('Plomberie', objectLines_(data.plumbing))}
${section_('Électricité / ventilation', objectLines_(data.electrical))}
${section_('Projet souhaité', objectLines_(data.project))}
${section_('Matériaux connus', summary.knownMaterials)}
${section_('Points à confirmer', summary.materialsToConfirm + '\\n' + summary.blockingPoints)}
${section_('Questions sous-traitant', summary.subcontractorQuestions)}
<div class="section"><div class="section-title">Conclusion</div><div class="box"><span class="pill">${escapeHtml_(draft.completenessStatus)}</span><br/>${escapeHtml_(draft.blockingPoints && draft.blockingPoints.length ? draft.blockingPoints.join('\\n') : 'Dossier exploitable sans réserve majeure identifiée.')}</div></div>
</div><div class="footer"><div>193 Rue du Renard · 76000 Rouen · 07 67 49 13 24</div><b>fortisrenovation.fr</b></div></div></body></html>`;
}

function metaCell_(label, value) {
  return `<div class="cell"><div class="label">${escapeHtml_(label)}</div><div class="value">${escapeHtml_(value || 'Non renseigné')}</div></div>`;
}

function section_(title, value) {
  return `<div class="section"><div class="section-title">${escapeHtml_(title)}</div><div class="box">${escapeHtml_(value || 'Non renseigné')}</div></div>`;
}

function objectLines_(obj) {
  return Object.entries(obj || {})
    .filter(([_, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${labelize_(key)} : ${value}`)
    .join('\n') || 'Non renseigné';
}

function photoGrid_(photos) {
  return Object.values(photos || {})
    .map(photo => {
      if (photo.status === 'Ajoutée' && photo.url) {
        return `<div class="photo"><img src="${escapeAttribute_(photo.url)}"/><div class="photo-caption">${escapeHtml_(photo.label)}</div></div>`;
      }
      return `<div class="photo"><div class="photo-caption">${escapeHtml_(photo.label)} — ${escapeHtml_(photo.status || 'Non renseigné')}</div></div>`;
    })
    .join('');
}

function getNotionPage_(pageId, token) {
  const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'get',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': CONFIG.notionVersion },
    muteHttpExceptions: true,
  });
  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300) {
    throw new Error(`Erreur Notion ${response.getResponseCode()}: ${body.message || response.getContentText()}`);
  }
  return body;
}

function updateNotionUrlProperty_(pageId, propertyName, url, token) {
  const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': CONFIG.notionVersion },
    payload: JSON.stringify({ properties: { [propertyName]: { url } } }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) {
    throw new Error(`Erreur Notion ${response.getResponseCode()}: ${response.getContentText()}`);
  }
}

function getPropertyText_(page, propertyName) {
  const property = page.properties && page.properties[propertyName];
  if (!property) return '';
  if (property.url) return property.url;
  if (property.email) return property.email;
  if (property.phone_number) return property.phone_number;
  if (property.select) return property.select.name || '';
  if (property.status) return property.status.name || '';
  if (property.number !== undefined && property.number !== null) return String(property.number);
  if (property.date) return property.date.start || '';
  if (property.title) return richTextToPlain_(property.title);
  if (property.rich_text) return richTextToPlain_(property.rich_text);
  if (property.place) return property.place.name || property.place.address || '';
  return '';
}

function richTextToPlain_(items) {
  return (items || []).map(item => item.plain_text || '').join('');
}

function extractDriveFolderId_(value) {
  if (!value) return '';
  const patterns = [/\/folders\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /^([a-zA-Z0-9_-]{20,})$/];
  for (const pattern of patterns) {
    const match = String(value).match(pattern);
    if (match) return match[1];
  }
  return '';
}

function buildAffaireFolderName_(draft, affairePage) {
  const description = getPropertyText_(affairePage, 'Description') || getClientName_(draft) || '';
  const prefix = draft.formData && draft.formData.identification && draft.formData.identification.affNumber || 'Affaire';
  return sanitizeFilename_(`${prefix} - ${description}`.trim()).substring(0, 120);
}

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(`Propriete Apps Script manquante: ${name}`);
  return value;
}

function getClientName_(draft) {
  return draft.formData && draft.formData.identification && draft.formData.identification.clientName;
}

function labelize_(key) {
  return String(key).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}

function sanitizeFilename_(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '-');
}

function escapeHtml_(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute_(value) {
  return escapeHtml_(value).replace(/`/g, '&#96;');
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

