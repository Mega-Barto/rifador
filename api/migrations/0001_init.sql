CREATE TABLE asignaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT NOT NULL DEFAULT ''
);

CREATE TABLE numeros (
  numero INTEGER PRIMARY KEY CHECK (numero >= 0 AND numero <= 99),
  asignacion_id INTEGER NOT NULL REFERENCES asignaciones (id) ON DELETE CASCADE
);

CREATE INDEX idx_numeros_asignacion ON numeros (asignacion_id);

INSERT INTO asignaciones (id, nombre, contacto) VALUES
  (1, 'Alais', ''),
  (2, 'Ferney Marcela', ''),
  (3, 'Claudia Molano', ''),
  (4, 'Olga Lucia G 💰', ''),
  (5, 'Martin Toro', ''),
  (6, 'Yenni 💰', ''),
  (7, 'Faisury 💰', ''),
  (8, 'Estela Gallego 💰', ''),
  (9, 'Amparo García 💰', ''),
  (10, 'Lina Mitaca', ''),
  (11, 'Mabel G', ''),
  (12, 'Santiago Valencia 💰', ''),
  (13, 'Magda Compañera 💰', ''),
  (14, 'Clemencia', ''),
  (15, 'Don Alberto 💰', ''),
  (16, 'Doña Rosa 301', ''),
  (17, 'Martica clínica', ''),
  (18, 'María Iboneth 💰', ''),
  (19, 'Angelita mamacita.', ''),
  (20, 'Camilo Toro', ''),
  (21, 'Luis', '');

INSERT INTO numeros (numero, asignacion_id) VALUES
  (6, 1), (29, 1),
  (7, 2),
  (8, 3),
  (10, 4), (20, 4), (83, 4),
  (11, 5),
  (14, 6), (84, 6),
  (17, 7), (19, 7), (22, 7), (26, 7), (30, 7), (82, 7),
  (18, 8),
  (25, 9),
  (27, 10),
  (28, 11), (98, 11),
  (35, 12), (41, 12),
  (37, 13),
  (44, 14),
  (49, 15), (76, 15),
  (63, 16),
  (65, 17),
  (70, 18),
  (71, 19),
  (73, 20),
  (92, 21);
