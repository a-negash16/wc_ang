const SHEETS = {
  managers: 'managers',
  matches: 'prediction_matches',
  predictions: 'prediction_submissions',
  audit: 'prediction_audit',
};

const TOKEN_TTL_SECONDS = 6 * 60 * 60;
const LOCK_BEFORE_KICKOFF_MS = 60 * 60 * 1000;

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(request.action || '').trim();

    if (action === 'login') {
      return jsonResponse(loginManager_(request));
    }
    if (action === 'submit_prediction') {
      return jsonResponse(submitPrediction_(request));
    }

    return jsonResponse({ ok: false, message: 'Unknown action' }, 400);
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message }, 400);
  }
}

function loginManager_(request) {
  const managerId = clean_(request.manager_id);
  const pin = String(request.pin || '');
  const groupSlug = clean_(request.group_slug);

  if (!managerId || !pin || !groupSlug) {
    throw new Error('Manager, PIN, and group are required');
  }

  const manager = findManager_(managerId, groupSlug);
  if (!manager || String(manager.is_active).toLowerCase() === 'false') {
    throw new Error('Manager not found');
  }
  if (!isValidPin_(pin, manager)) {
    throw new Error('Invalid PIN');
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
  const token = signToken_({
    manager_id: manager.manager_id,
    group_slug: manager.group_slug,
    expires_at: expiresAt,
  });

  return {
    ok: true,
    token,
    manager_id: manager.manager_id,
    display_name: manager.display_name || manager.manager_id,
    group_slug: manager.group_slug,
    expires_at: expiresAt,
  };
}

function submitPrediction_(request) {
  const claims = verifyToken_(clean_(request.token));
  const managerId = clean_(request.manager_id);
  const groupSlug = clean_(request.group_slug);
  const matchId = clean_(request.match_id);
  const pick = clean_(request.pick);

  if (!managerId || !groupSlug || !matchId || !pick) {
    throw new Error('Manager, group, match, and pick are required');
  }
  if (claims.manager_id !== managerId || claims.group_slug !== groupSlug) {
    throw new Error('Session does not match manager');
  }

  const match = findMatch_(matchId, groupSlug);
  if (!match) {
    throw new Error('Match not found');
  }
  if (String(match.status || '').toLowerCase() === 'finished') {
    throw new Error('Match is already complete');
  }

  const kickoffAt = new Date(match.kickoff_at);
  if (Number.isNaN(kickoffAt.getTime())) {
    throw new Error('Match kickoff is not configured');
  }
  const deadlineAt = new Date(kickoffAt.getTime() - LOCK_BEFORE_KICKOFF_MS);
  if (Date.now() >= deadlineAt.getTime()) {
    throw new Error('Deadline passed');
  }

  const allowedPicks = [clean_(match.home_code), 'Tie', clean_(match.away_code)];
  if (!allowedPicks.includes(pick)) {
    throw new Error('Pick is not valid for this match');
  }

  const previous = upsertPrediction_(managerId, groupSlug, match, pick, deadlineAt);
  if (previous && previous.pick !== pick) {
    appendAudit_(managerId, groupSlug, match.match_id, previous.pick, pick);
  }

  return {
    ok: true,
    message: 'Prediction saved',
    manager_id: managerId,
    match_id: match.match_id,
    pick,
    deadline_at: deadlineAt.toISOString(),
  };
}

function findManager_(managerId, groupSlug) {
  return readObjects_(SHEETS.managers).find((row) => {
    return clean_(row.manager_id).toLowerCase() === managerId.toLowerCase()
      && clean_(row.group_slug) === groupSlug;
  });
}

function findMatch_(matchId, groupSlug) {
  return readObjects_(SHEETS.matches).find((row) => {
    return clean_(row.match_id) === matchId && clean_(row.group_slug) === groupSlug;
  });
}

function upsertPrediction_(managerId, groupSlug, match, pick, deadlineAt) {
  const sheet = getSheet_(SHEETS.predictions);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const index = headerIndex_(headers);
  const now = new Date().toISOString();
  const rowObject = {
    submitted_at: now,
    updated_at: now,
    group_slug: groupSlug,
    manager_id: managerId,
    match_id: match.match_id,
    home_code: match.home_code,
    away_code: match.away_code,
    pick,
    deadline_at: deadlineAt.toISOString(),
    status: 'active',
  };

  for (let rowNumber = 2; rowNumber <= values.length; rowNumber += 1) {
    const row = values[rowNumber - 1];
    if (
      clean_(row[index.manager_id]) === managerId
      && clean_(row[index.group_slug]) === groupSlug
      && clean_(row[index.match_id]) === match.match_id
      && clean_(row[index.status] || 'active') === 'active'
    ) {
      const previous = objectFromRow_(headers, row);
      writeObjectToRow_(sheet, rowNumber, headers, Object.assign(previous, rowObject, {
        submitted_at: previous.submitted_at || now,
      }));
      return previous;
    }
  }

  sheet.appendRow(headers.map((header) => rowObject[header] || ''));
  return null;
}

function appendAudit_(managerId, groupSlug, matchId, oldPick, newPick) {
  const sheet = getSheet_(SHEETS.audit);
  sheet.appendRow([new Date().toISOString(), groupSlug, managerId, matchId, oldPick, newPick]);
}

function isValidPin_(pin, manager) {
  const plainPin = String(manager.pin || '');
  if (plainPin && pin === plainPin) return true;

  const expectedHash = clean_(manager.pin_sha256);
  if (!expectedHash) return false;
  return sha256Hex_(pin) === expectedHash.toLowerCase();
}

function signToken_(claims) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify(claims));
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, getTokenSecret_())
  );
  return `${payload}.${signature}`;
}

function verifyToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Invalid session');

  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], getTokenSecret_())
  );
  if (parts[1] !== expected) throw new Error('Invalid session');

  const claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!claims.expires_at || new Date(claims.expires_at).getTime() <= Date.now()) {
    throw new Error('Session expired');
  }
  return claims;
}

function getTokenSecret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret) {
    throw new Error('TOKEN_SECRET script property is not configured');
  }
  return secret;
}

function readObjects_(sheetName) {
  const values = getSheet_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map((row) => objectFromRow_(headers, row));
}

function objectFromRow_(headers, row) {
  return headers.reduce((record, header, index) => {
    record[header] = row[index];
    return record;
  }, {});
}

function writeObjectToRow_(sheet, rowNumber, headers, record) {
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map((header) => record[header] || ''),
  ]);
}

function headerIndex_(headers) {
  return headers.reduce((index, header, position) => {
    index[header] = position;
    return index;
  }, {});
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet tab: ${name}`);
  return sheet;
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    .map((byte) => (`0${(byte < 0 ? byte + 256 : byte).toString(16)}`).slice(-2))
    .join('');
}

function clean_(value) {
  return String(value || '').trim();
}

function jsonResponse(payload, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ status: statusCode || 200 }, payload)))
    .setMimeType(ContentService.MimeType.JSON);
}
