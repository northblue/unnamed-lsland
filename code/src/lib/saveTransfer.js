import { createHash } from 'node:crypto';
import { validateIslandState } from '../game/islandState.js';

export const TRANSFER_FORMAT = 'unnamed-island-transfer';
export const ISLAND_ID = 'local-island';
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function validRevision(value) {
  if (!Number.isInteger(value) || value < 0 || value > 2147483647) throw new Error('Invalid source revision');
  return value;
}

export function createTransfer(record, exportedAt = new Date().toISOString()) {
  if (record.id !== ISLAND_ID) throw new Error('Unexpected source island ID');
  const state = validateIslandState({ version: 1, name: record.name, wood: record.wood, stone: record.stone,
    player: { x: record.playerX, z: record.playerZ }, resources: record.resourceState,
    buildings: record.buildings, catches: record.catches, pond: record.pond });
  if (state.name.includes('\0') || !state.name.isWellFormed()) throw new Error('Island name is not valid PostgreSQL text');
  const source = { kind: 'local-d1', islandId: ISLAND_ID, revision: validRevision(record.revision),
    updatedAt: new Date(record.updatedAt).toISOString() };
  const payload = { format: TRANSFER_FORMAT, version: 1, exportedAt: new Date(exportedAt).toISOString(), source, state };
  return { ...payload, checksum: sha256(JSON.stringify(payload)) };
}

export function validateTransfer(value) {
  if (value?.format !== TRANSFER_FORMAT || value.version !== 1 || value.source?.kind !== 'local-d1') throw new Error('Invalid transfer format');
  const rebuilt = createTransfer({ id: value.source.islandId, revision: value.source.revision, updatedAt: value.source.updatedAt,
    name: value.state?.name, wood: value.state?.wood, stone: value.state?.stone, playerX: value.state?.player?.x,
    playerZ: value.state?.player?.z, resourceState: value.state?.resources, buildings: value.state?.buildings,
    catches: value.state?.catches, pond: value.state?.pond }, value.exportedAt);
  if (value.checksum !== rebuilt.checksum) throw new Error('Transfer checksum mismatch');
  return rebuilt;
}

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;

function stateExpression() {
  return `jsonb_build_object('version', 1, 'name', "name", 'wood', "wood", 'stone', "stone",
    'player', jsonb_build_object('x', "playerX", 'z', "playerZ"), 'resources', "resourceState",
    'buildings', "buildings", 'catches', "catches", 'pond', "pond")`;
}

function verification(transfer) {
  return `SELECT 1 / CASE WHEN current_database() = 'unnamed_island'
  AND (SELECT count(*) FROM public."Island") = 1
  AND EXISTS (SELECT 1 FROM public."Island" WHERE "id" = 'local-island'
    AND "revision" = ${transfer.source.revision}
    AND "updatedAt" = ${literal(transfer.source.updatedAt)}::timestamp(3)
    AND ${stateExpression()} = ${json(transfer.state)})
  THEN 1 ELSE 0 END AS state_verified;`;
}

export function transferSql(value) {
  const transfer = validateTransfer(value);
  const { state: s, source } = transfer;
  // User strings appear only in SQL string literals, never in a DO dollar-quoted body.
  const preamble = `\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
SET LOCAL standard_conforming_strings = on;
SET LOCAL ROLE island_app;
DO $transfer_guard$
BEGIN
  IF current_database() <> 'unnamed_island' THEN
    RAISE EXCEPTION 'Wrong database: import requires unnamed_island';
  END IF;
END $transfer_guard$;
`;
  const importSql = `${preamble}LOCK TABLE public."Island" IN ACCESS EXCLUSIVE MODE;
DO $transfer_empty$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Island") THEN
    RAISE EXCEPTION 'Target Island table is not empty; refusing to overwrite';
  END IF;
END $transfer_empty$;
INSERT INTO public."Island" ("id", "name", "wood", "stone", "playerX", "playerZ", "resourceState",
  "buildings", "catches", "pond", "revision", "updatedAt") VALUES (
  'local-island', ${literal(s.name)}, ${s.wood}, ${s.stone}, ${s.player.x}, ${s.player.z}, ${json(s.resources)},
  ${json(s.buildings)}, ${json(s.catches)}, ${json(s.pond)}, ${source.revision}, ${literal(source.updatedAt)}::timestamp(3));
${verification(transfer)}
COMMIT;
\\echo 'Import committed. Original Mac D1 data was not changed.'
`;
  const verifySql = `\\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL standard_conforming_strings = on;
SET LOCAL ROLE island_app;
${verification(transfer)}
COMMIT;
\\echo 'Saved state, revision and timestamp match the exported snapshot.'
`;
  return { importSql, verifySql };
}
