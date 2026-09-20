import { pool } from './db.js';

function iso(value) { return value?.toISOString?.() || value || null; }
function baseCampaign(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, type: row.type, instance: row.instance, status: row.status,
    delayMs: row.delay_ms, payload: row.payload || {}, total: row.total, sent: row.sent, failed: row.failed,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at), error: row.error || undefined,
  };
}
async function attachData(campaign) {
  if (!campaign) return null;

  const [recipients, results] = await Promise.all([
    pool.query(
      `
        SELECT
          recipient_index,
          recipient
        FROM campaign_recipients
        WHERE campaign_id = $1
        ORDER BY recipient_index
      `,
      [campaign.id],
    ),

    pool.query(
      `
        SELECT
          r.recipient_index AS index,
          r.phone,
          r.ok,
          r.message,
          r.timestamp,
          COALESCE(m.statuses, '[]'::jsonb) AS delivery_statuses
        FROM campaign_results r
        LEFT JOIN (
          SELECT
            campaign_id,
            recipient_index,
            jsonb_agg(
              jsonb_build_object(
                'messageId', message_id,
                'type', message_type,
                'status', status,
                'updatedAt', status_updated_at
              )
              ORDER BY status_updated_at
            ) AS statuses
          FROM campaign_messages
          GROUP BY campaign_id, recipient_index
        ) m
          ON m.campaign_id = r.campaign_id
          AND m.recipient_index = r.recipient_index
        WHERE r.campaign_id = $1
        ORDER BY r.recipient_index
      `,
      [campaign.id],
    ),
  ]);

  return {
    ...campaign,

    recipients: recipients.rows.map((row) => row.recipient || {}),

    results: results.rows.map((row) => ({
      index: row.index,
      phone: row.phone,
      ok: row.ok,
      message: row.message || undefined,
      timestamp: iso(row.timestamp),
      deliveryStatuses: row.delivery_statuses || [],
    })),
  };
}
export async function enqueueCampaignJob(id) {
  await pool.query(
    `INSERT INTO campaign_queue(campaign_id,status,attempts,available_at)
     VALUES($1,'queued',0,NOW())
     ON CONFLICT(campaign_id) DO UPDATE
       SET status=CASE WHEN campaign_queue.status IN ('failed','completed') THEN 'queued' ELSE campaign_queue.status END,
           available_at=NOW(), updated_at=NOW()`,
    [id],
  );
}
export async function claimNextCampaignJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT campaign_id,attempts
       FROM campaign_queue
       WHERE status='queued' AND available_at<=NOW()
       ORDER BY available_at,created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
    );
    if (!rows[0]) { await client.query('COMMIT'); return null; }
    const attempts = Number(rows[0].attempts || 0) + 1;
    await client.query(
      `UPDATE campaign_queue SET status='running',attempts=$2,locked_at=NOW(),updated_at=NOW() WHERE campaign_id=$1`,
      [rows[0].campaign_id, attempts],
    );
    await client.query('COMMIT');
    return { campaignId: rows[0].campaign_id, attempts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
export async function finishCampaignJob(id, status = 'completed', error = null) {
  await pool.query(
    `UPDATE campaign_queue SET status=$2,error=$3,locked_at=NULL,updated_at=NOW() WHERE campaign_id=$1`,
    [id,status,error],
  );
}
export async function recoverCampaignJobs() {
  const { rows } = await pool.query(
    `UPDATE campaign_queue
     SET status='queued',locked_at=NULL,updated_at=NOW()
     WHERE status='running' AND locked_at < NOW() - INTERVAL '5 minutes'
     RETURNING campaign_id`,
  );
  const queued = await pool.query(`SELECT campaign_id FROM campaign_queue WHERE status='queued' AND available_at<=NOW() ORDER BY created_at`);
  return [...rows.map((r) => r.campaign_id), ...queued.rows.map((r) => r.campaign_id)];
}
export async function getQueueStats() {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE status='queued')::int queued,
      COUNT(*) FILTER (WHERE status='running')::int running,
      COUNT(*) FILTER (WHERE status='failed')::int failed,
      COUNT(*) FILTER (WHERE status='completed')::int completed
     FROM campaign_queue`,
  );
  return rows[0] || { queued:0,running:0,failed:0,completed:0 };
}
export async function listCampaigns({ limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { rows } = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return Promise.all(rows.map((row) => attachData(baseCampaign(row))));
}
export async function getCampaign(id) {
  const { rows } = await pool.query('SELECT * FROM campaigns WHERE id=$1 LIMIT 1', [id]);
  return attachData(baseCampaign(rows[0]));
}
export async function createCampaign(input) {
  const now = new Date().toISOString();
  const campaign = {
    id: cryptoRandomId(), name: String(input.name || 'Untitled campaign').trim() || 'Untitled campaign',
    type: input.type, instance: input.instance, status: 'queued', delayMs: input.delayMs,
    recipients: input.recipients || [], payload: input.payload || {}, total: (input.recipients || []).length,
    sent: 0, failed: 0, results: [], createdAt: now, updatedAt: now, startedAt: null, completedAt: null,
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO campaigns(id,name,type,instance,status,delay_ms,payload,total,sent,failed,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
      [campaign.id,campaign.name,campaign.type,campaign.instance,campaign.status,campaign.delayMs,JSON.stringify(campaign.payload),campaign.total,0,0,now,now]
    );
    for (let i = 0; i < campaign.recipients.length; i += 1) {
      const recipient = campaign.recipients[i] || {};
      await client.query(
        `INSERT INTO campaign_recipients(campaign_id,recipient_index,phone,recipient) VALUES($1,$2,$3,$4::jsonb)`,
        [campaign.id,i,String(recipient.phone || recipient.number || ''),JSON.stringify(recipient)]
      );
    }
    await client.query('COMMIT');
    return campaign;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function updateCampaign(id, patch) {
  const current = await getCampaign(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await pool.query(
    `UPDATE campaigns SET name=$2,type=$3,instance=$4,status=$5,delay_ms=$6,payload=$7::jsonb,total=$8,sent=$9,failed=$10,
      updated_at=$11,started_at=$12,completed_at=$13,error=$14 WHERE id=$1`,
    [id,next.name,next.type,next.instance,next.status,next.delayMs,JSON.stringify(next.payload),next.total,next.sent,next.failed,next.updatedAt,next.startedAt,next.completedAt,next.error || null]
  );
  return next;
}
export async function recordCampaignMessage(id, recipientIndex, messageId, messageType, status = 'PENDING') {
  if (!messageId) return;
  await pool.query(
    `INSERT INTO campaign_messages(campaign_id,recipient_index,message_id,message_type,status,status_updated_at)
     VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(campaign_id,message_id) DO NOTHING`,
    [id, recipientIndex, messageId, messageType, status]
  );
}
export async function updateCampaignMessageStatus(messageId, status) {
  const { rows } = await pool.query(
    `UPDATE campaign_messages SET status=$2,status_updated_at=NOW() WHERE message_id=$1 RETURNING campaign_id,recipient_index,message_id,message_type,status,status_updated_at`,
    [messageId, status]
  );
  return rows[0] || null;
}
export async function recordCampaignResult(id, result, counts) {
  const timestamp = result.timestamp || new Date().toISOString();
  await pool.query(
    `INSERT INTO campaign_results(campaign_id,recipient_index,phone,ok,message,timestamp)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(campaign_id,recipient_index) DO UPDATE SET phone=EXCLUDED.phone,ok=EXCLUDED.ok,message=EXCLUDED.message,timestamp=EXCLUDED.timestamp`,
    [id,result.index,result.phone || '',Boolean(result.ok),result.message || null,timestamp]
  );
  return updateCampaign(id, { sent: counts.sent, failed: counts.failed });
}
function cryptoRandomId() { return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`; }
