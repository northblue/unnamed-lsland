import { getPrisma } from '../../../lib/prisma';
import { createIslandState, validateIslandState } from '../../../game/islandState';
import { checkIslandRequest } from '../../../lib/requestAccess';

export const runtime = 'nodejs';
const ISLAND_ID = 'local-island';
const headers = { 'Cache-Control': 'no-store' };

function response(record) {
  return { revision: record.revision, updatedAt: record.updatedAt,
    state: validateIslandState({ version: 1, name: record.name, wood: record.wood, stone: record.stone, catches: record.catches, pond: record.pond,
      player: { x: record.playerX, z: record.playerZ }, resources: record.resourceState,
      buildings: record.buildings.map(({ id, type, x, z }) => ({ id, type, x, z })) }) };
}

export async function GET(request) {
  if (!checkIslandRequest(request)) return Response.json({ error: 'localOnly' }, { status: 403, headers });
  try {
    const prisma = getPrisma();
    const initial = createIslandState();
    let record = await prisma.island.findUnique({ where: { id: ISLAND_ID } });
    if (!record) {
      try {
        record = await prisma.island.create({ data: { id: ISLAND_ID, name: initial.name, resourceState: initial.resources, buildings: [] } });
      } catch (error) {
        // Two first-time requests can race to initialize the same development island.
        if (error.code !== 'P2002') throw error;
        record = await prisma.island.findUniqueOrThrow({ where: { id: ISLAND_ID } });
      }
    }
    return Response.json(response(record), { headers });
  } catch (error) {
    console.error('Island load failed:', error.message);
    return Response.json({ error: 'databaseUnavailable' }, { status: 503, headers });
  }
}

export async function PUT(request) {
  if (!checkIslandRequest(request, true)) return Response.json({ error: 'localOnly' }, { status: 403, headers });
  let state;
  let revision;
  try {
    const body = await request.text();
    if (body.length > 100000) throw new Error('invalidWorld');
    const input = JSON.parse(body);
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('invalidRevision');
    revision = input.revision;
    state = validateIslandState(input.state);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers });
  }
  try {
    const result = await getPrisma().island.update({ where: { id: ISLAND_ID, revision }, data: {
        name: state.name, wood: state.wood, stone: state.stone, playerX: state.player.x, playerZ: state.player.z,
        resourceState: state.resources, buildings: state.buildings, catches: state.catches, pond: state.pond, revision: { increment: 1 },
      } });
    return Response.json(response(result), { headers });
  } catch (error) {
    if (error.code === 'P2025') return Response.json({ error: 'saveConflict' }, { status: 409, headers });
    console.error('Island save failed:', error.message);
    return Response.json({ error: 'databaseUnavailable' }, { status: 503, headers });
  }
}
