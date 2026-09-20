import { Router } from 'express';
import { authUser, requirePermission } from './auth.routes.js';
import { pool } from '../services/db.js';

export const templatesRouter = Router();
templatesRouter.use(authUser);
const allowedTypes = ['text','media','media-text','buttons','list','media-buttons','media-list'];

function mapTemplate(row) {
  return { id: row.id, name: row.name, type: row.type, ...row.data, createdAt: row.created_at?.toISOString?.() || row.created_at, updatedAt: row.updated_at?.toISOString?.() || row.updated_at };
}
function validate(body) {
  const name = String(body?.name || '').trim();
  const type = String(body?.type || '').trim();
  if (!name) throw Object.assign(new Error('Template name is required.'), { status: 400 });
  if (!allowedTypes.includes(type)) throw Object.assign(new Error('Unsupported template type.'), { status: 400 });
  const data = body?.data && typeof body.data === 'object' ? body.data : {};
  const category = String(body?.category || data.category || 'Marketing').trim();
  const status = String(body?.status || data.status || 'draft').trim();
  if (!['Marketing', 'Utility', 'Support', 'Follow-up'].includes(category)) {
    throw Object.assign(new Error('Unsupported template category.'), { status: 400 });
  }
  if (!['draft', 'approved', 'paused'].includes(status)) {
    throw Object.assign(new Error('Unsupported template status.'), { status: 400 });
  }
  const {
    title: _legacyTitle,
    description: _legacyDescription,
    footer: _legacyFooter,
    footerText: _legacyFooterText,
    ...cleanData
  } = data;
  return { name, type, data: { ...cleanData, category, status } };
}
templatesRouter.get('/', requirePermission('templatesUse'), async (_req,res,next)=>{ try { const {rows}=await pool.query('SELECT * FROM templates ORDER BY updated_at DESC'); res.json(rows.map(mapTemplate)); } catch(e){next(e);} });
templatesRouter.post('/', requirePermission('templatesManage'), async (req,res,next)=>{ try { const input=validate(req.body); const id=`tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`; const {rows}=await pool.query('INSERT INTO templates(id,name,type,data) VALUES($1,$2,$3,$4::jsonb) RETURNING *',[id,input.name,input.type,JSON.stringify(input.data)]); res.status(201).json(mapTemplate(rows[0])); } catch(e){next(e);} });
templatesRouter.put('/:id', requirePermission('templatesManage'), async (req,res,next)=>{ try { const input=validate(req.body); const {rows}=await pool.query('UPDATE templates SET name=$2,type=$3,data=$4::jsonb,updated_at=NOW() WHERE id=$1 RETURNING *',[req.params.id,input.name,input.type,JSON.stringify(input.data)]); if(!rows[0]) return res.status(404).json({message:'Template not found.'}); res.json(mapTemplate(rows[0])); } catch(e){next(e);} });
templatesRouter.delete('/:id', requirePermission('templatesManage'), async (req,res,next)=>{ try { const {rowCount}=await pool.query('DELETE FROM templates WHERE id=$1',[req.params.id]); if(!rowCount) return res.status(404).json({message:'Template not found.'}); res.status(204).end(); } catch(e){next(e);} });
