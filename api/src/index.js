const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const SEED = [
  { nombre: "Alais", contacto: "", numeros: [6, 29] },
  { nombre: "Ferney Marcela", contacto: "", numeros: [7] },
  { nombre: "Claudia Molano", contacto: "", numeros: [8] },
  { nombre: "Olga Lucia G 💰", contacto: "", numeros: [10, 20, 83] },
  { nombre: "Martin Toro", contacto: "", numeros: [11] },
  { nombre: "Yenni 💰", contacto: "", numeros: [14, 84] },
  { nombre: "Faisury 💰", contacto: "", numeros: [17, 19, 22, 26, 30, 82] },
  { nombre: "Estela Gallego 💰", contacto: "", numeros: [18] },
  { nombre: "Amparo García 💰", contacto: "", numeros: [25] },
  { nombre: "Lina Mitaca", contacto: "", numeros: [27] },
  { nombre: "Mabel G", contacto: "", numeros: [28, 98] },
  { nombre: "Santiago Valencia 💰", contacto: "", numeros: [35, 41] },
  { nombre: "Magda Compañera 💰", contacto: "", numeros: [37] },
  { nombre: "Clemencia", contacto: "", numeros: [44] },
  { nombre: "Don Alberto 💰", contacto: "", numeros: [49, 76] },
  { nombre: "Doña Rosa 301", contacto: "", numeros: [63] },
  { nombre: "Martica clínica", contacto: "", numeros: [65] },
  { nombre: "María Iboneth 💰", contacto: "", numeros: [70] },
  { nombre: "Angelita mamacita.", contacto: "", numeros: [71] },
  { nombre: "Camilo Toro", contacto: "", numeros: [73] },
  { nombre: "Luis", contacto: "", numeros: [92] },
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    await ensureReady(env);

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/asignaciones(?:\/(\d+))?$/);
    if (!match) return cors(json({ error: "No encontrado." }, 404));

    try {
      const id = match[1] ? Number(match[1]) : null;
      if (request.method === "GET" && id === null) return cors(json(await list(env)));
      if (request.method === "POST" && id === null) return cors(json(await create(env, await readBody(request)), 201));
      if (request.method === "PUT" && id === null) return cors(json(await replaceAll(env, await readBody(request))));
      if (request.method === "PUT" && id !== null) return cors(json(await update(env, id, await readBody(request))));
      if (request.method === "DELETE" && id !== null) {
        await remove(env, id);
        return cors(new Response(null, { status: 204 }));
      }
      return cors(json({ error: "Método no permitido." }, 405));
    } catch (err) {
      const status = err.status ?? 500;
      return cors(json({ error: err.message || "Error del servidor." }, status));
    }
  },
};

async function ensureReady(env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS asignaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        contacto TEXT NOT NULL DEFAULT ''
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS numeros (
        numero INTEGER PRIMARY KEY CHECK (numero >= 0 AND numero <= 99),
        asignacion_id INTEGER NOT NULL REFERENCES asignaciones (id) ON DELETE CASCADE
      )`,
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_numeros_asignacion ON numeros (asignacion_id)"),
  ]);
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM asignaciones").first();
  if (row.n > 0) return;
  await replaceAll(env, { asignaciones: SEED });
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    fail(400, "El cuerpo no es JSON válido.");
  }
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function parseAssignment(body) {
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const contacto = typeof body?.contacto === "string" ? body.contacto.trim() : "";
  const numeros = body?.numeros;
  if (!nombre) fail(400, "El nombre es obligatorio.");
  if (contacto && !/^\d{7,15}$/.test(contacto)) fail(400, "Poner un número válido.");
  if (!Array.isArray(numeros) || numeros.length === 0) fail(400, "Debe quedar al menos un número.");
  const unique = [...new Set(numeros)];
  for (const n of unique) {
    if (!Number.isInteger(n) || n < 0 || n > 99) fail(400, "Número fuera de rango.");
  }
  unique.sort((a, b) => a - b);
  return { nombre, contacto, numeros: unique };
}

async function list(env) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.nombre, a.contacto, n.numero
     FROM asignaciones a
     LEFT JOIN numeros n ON n.asignacion_id = a.id
     ORDER BY a.id, n.numero`,
  ).all();
  const byId = new Map();
  for (const row of results) {
    if (!byId.has(row.id)) {
      byId.set(row.id, { id: row.id, nombre: row.nombre, contacto: row.contacto, numeros: [] });
    }
    if (row.numero !== null) byId.get(row.id).numeros.push(row.numero);
  }
  return { asignaciones: [...byId.values()] };
}

async function takenByOthers(env, numeros, exceptId) {
  const placeholders = numeros.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT numero FROM numeros WHERE numero IN (${placeholders}) AND asignacion_id != ?`,
  )
    .bind(...numeros, exceptId ?? -1)
    .all();
  return results.map((row) => row.numero);
}

async function create(env, body) {
  const data = parseAssignment(body);
  const taken = await takenByOthers(env, data.numeros, null);
  if (taken.length) fail(409, `Ya están asignados: ${taken.join(", ")}.`);

  const inserted = await env.DB.prepare("INSERT INTO asignaciones (nombre, contacto) VALUES (?, ?) RETURNING id")
    .bind(data.nombre, data.contacto)
    .first();
  try {
    await insertNumbers(env, inserted.id, data.numeros);
  } catch (err) {
    await env.DB.prepare("DELETE FROM asignaciones WHERE id = ?").bind(inserted.id).run();
    throw err;
  }
  return { id: inserted.id, ...data };
}

async function update(env, id, body) {
  const current = await env.DB.prepare("SELECT id FROM asignaciones WHERE id = ?").bind(id).first();
  if (!current) fail(404, "Esa asignación ya no existe.");
  const data = parseAssignment(body);
  const taken = await takenByOthers(env, data.numeros, id);
  if (taken.length) fail(409, `Ya están asignados: ${taken.join(", ")}.`);

  await env.DB.batch([
    env.DB.prepare("UPDATE asignaciones SET nombre = ?, contacto = ? WHERE id = ?").bind(data.nombre, data.contacto, id),
    env.DB.prepare("DELETE FROM numeros WHERE asignacion_id = ?").bind(id),
    ...data.numeros.map((n) =>
      env.DB.prepare("INSERT INTO numeros (numero, asignacion_id) VALUES (?, ?)").bind(n, id),
    ),
  ]);
  return { id, ...data };
}

async function remove(env, id) {
  const result = await env.DB.prepare("DELETE FROM asignaciones WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) fail(404, "Esa asignación ya no existe.");
}

async function replaceAll(env, body) {
  const list = Array.isArray(body) ? body : body?.asignaciones;
  if (!Array.isArray(list)) fail(400, "Formato no reconocido.");
  const parsed = list.map(parseAssignment);
  const seen = new Set();
  for (const item of parsed) {
    for (const n of item.numeros) {
      if (seen.has(n)) fail(400, `El número ${n} está repetido.`);
      seen.add(n);
    }
  }

  const statements = [
    env.DB.prepare("DELETE FROM numeros"),
    env.DB.prepare("DELETE FROM asignaciones"),
  ];
  parsed.forEach((item, index) => {
    statements.push(
      env.DB.prepare("INSERT INTO asignaciones (id, nombre, contacto) VALUES (?, ?, ?)").bind(
        index + 1,
        item.nombre,
        item.contacto,
      ),
    );
    item.numeros.forEach((n) => {
      statements.push(
        env.DB.prepare("INSERT INTO numeros (numero, asignacion_id) VALUES (?, ?)").bind(n, index + 1),
      );
    });
  });
  statements.push(env.DB.prepare("DELETE FROM sqlite_sequence WHERE name = 'asignaciones'"));
  if (parsed.length > 0) {
    statements.push(
      env.DB.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('asignaciones', ?)").bind(parsed.length),
    );
  }
  await env.DB.batch(statements);
  return list(env);
}

async function insertNumbers(env, id, numeros) {
  await env.DB.batch(
    numeros.map((n) => env.DB.prepare("INSERT INTO numeros (numero, asignacion_id) VALUES (?, ?)").bind(n, id)),
  );
}
