import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const NUMBERS = Array.from({ length: 100 }, (_, i) => i)

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo conectar con la base de datos.')
  return data
}

function fold(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

// Acepta un array o { asignaciones: [...] }. Lanza Error si es inválido.
function validateAssignments(data) {
  const list = Array.isArray(data) ? data : data?.asignaciones
  if (!Array.isArray(list)) throw new Error('Formato no reconocido.')
  const seen = new Set()
  return list.map((item, idx) => {
    const { nombre, contacto = '', numeros } = item ?? {}
    if (typeof nombre !== 'string' || typeof contacto !== 'string' || !Array.isArray(numeros)) {
      throw new Error(`Asignación #${idx + 1} inválida.`)
    }
    if (!nombre.trim()) throw new Error(`Asignación #${idx + 1} sin nombre.`)
    for (const n of numeros) {
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        throw new Error(`Número fuera de rango en la asignación #${idx + 1}.`)
      }
      if (seen.has(n)) throw new Error(`El número ${n} está repetido.`)
      seen.add(n)
    }
    return { nombre: nombre.trim(), contacto: contacto.trim(), numeros: [...numeros].sort((a, b) => a - b) }
  })
}

// Paleta del flyer de la Gran Rifa Navideña.
const FLYER = {
  cream: '#F5F4E9',
  burgundy: '#6D001D',
  gold: '#A6894E',
  goldLight: '#D4C08A',
  green: '#1D3D2A',
  ink: '#1a1a1a',
  white: '#ffffff',
  pine: '#2F5D3A',
  berry: '#B71C1C',
}

function drawStar(ctx, x, y, size, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a - 0.2) * size * 0.2, Math.sin(a - 0.2) * size * 0.2)
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size)
    ctx.lineTo(Math.cos(a + 0.2) * size * 0.2, Math.sin(a + 0.2) * size * 0.2)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPineCorner(ctx, x, y, flipX) {
  ctx.save()
  ctx.translate(x, y)
  if (flipX) ctx.scale(-1, 1)
  ctx.fillStyle = FLYER.pine
  const fronds = [
    [0, 18, 70, 8, 55, 38],
    [8, 42, 78, 28, 62, 62],
    [4, 64, 64, 52, 48, 88],
  ]
  for (const [ax, ay, bx, by, cx, cy] of fronds) {
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.quadraticCurveTo(bx, by, cx, cy)
    ctx.quadraticCurveTo(bx - 18, by + 8, ax + 6, ay + 14)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = FLYER.berry
  for (const [bx, by] of [
    [28, 28],
    [42, 36],
    [34, 48],
    [50, 52],
    [22, 56],
  ]) {
    ctx.beginPath()
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawDiamondDivider(ctx, y, width) {
  const mid = width / 2
  const arm = 150
  ctx.strokeStyle = FLYER.gold
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(mid - arm - 14, y)
  ctx.lineTo(mid - 14, y)
  ctx.moveTo(mid + 14, y)
  ctx.lineTo(mid + arm + 14, y)
  ctx.stroke()
  ctx.save()
  ctx.translate(mid, y)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = FLYER.gold
  ctx.fillRect(-5, -5, 10, 10)
  ctx.restore()
}

function drawGoldPill(ctx, cx, cy, text, font) {
  ctx.font = font
  const tw = ctx.measureText(text).width
  const w = tw + 48
  const h = 40
  const x = cx - w / 2
  const y = cy - h / 2
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, FLYER.gold)
  grad.addColorStop(0.5, FLYER.goldLight)
  grad.addColorStop(1, FLYER.gold)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.fillStyle = FLYER.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy + 1)
}

// Captura al estilo del flyer, con la cuadrícula 0–99.
function renderBoardImage(owners) {
  const CELL = 52
  const GAP = 5
  const GRID = 10 * CELL + 9 * GAP
  const W = 720
  const PAD_X = (W - GRID) / 2
  const GRID_Y = 430
  const H = GRID_Y + GRID + 180
  const scale = 2

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = FLYER.cream
  ctx.fillRect(0, 0, W, H)

  const stars = [
    [60, 160, 10],
    [120, 250, 7],
    [660, 170, 9],
    [600, 300, 6],
    [48, GRID_Y + 80, 7],
    [W - 48, GRID_Y + 120, 6],
    [70, H - 90, 8],
    [W - 70, H - 100, 7],
    [360, 118, 5],
  ]
  for (const [x, y, s] of stars) drawStar(ctx, x, y, s, FLYER.goldLight)

  drawPineCorner(ctx, 8, 8, false)
  drawPineCorner(ctx, W - 8, 8, true)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = FLYER.burgundy
  ctx.font = `800 48px ${font}`
  ctx.fillText('GRAN RIFA', W / 2, 88)

  ctx.fillStyle = FLYER.gold
  ctx.font = `800 40px ${font}`
  ctx.fillText('ANCHETA NAVIDEÑA', W / 2, 138)

  ctx.fillStyle = FLYER.green
  ctx.font = `700 22px ${font}`
  ctx.fillText('y 200 MIL PESOS EN EFECTIVO 🎄', W / 2, 186)

  ctx.fillStyle = FLYER.ink
  ctx.font = `600 16px ${font}`
  ctx.fillText('JUEGA el 21 de Noviembre', W / 2, 230)
  ctx.font = `500 15px ${font}`
  ctx.fillText('con las Dos últimas cifras de cafeterito tarde', W / 2, 254)

  drawDiamondDivider(ctx, 290, W)
  drawGoldPill(ctx, W / 2, 340, 'VALOR: $10.000', `700 18px ${font}`)

  ctx.fillStyle = FLYER.burgundy
  ctx.font = `700 15px ${font}`
  ctx.fillText(`Asignados: ${owners.size} / 100`, W / 2, 390)

  for (let n = 0; n < 100; n++) {
    const x = PAD_X + (n % 10) * (CELL + GAP)
    const y = GRID_Y + Math.floor(n / 10) * (CELL + GAP)
    const assigned = owners.has(n)

    ctx.beginPath()
    ctx.roundRect(x, y, CELL, CELL, 10)
    ctx.fillStyle = assigned ? FLYER.burgundy : FLYER.white
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = assigned ? FLYER.burgundy : FLYER.gold
    ctx.stroke()

    const cx = x + CELL / 2
    const cy = y + CELL / 2
    if (assigned) {
      ctx.fillStyle = FLYER.white
      ctx.font = `700 26px ${font}`
      ctx.fillText('✕', cx, cy)
      ctx.font = `700 11px ${font}`
      ctx.textAlign = 'right'
      ctx.fillText(String(n), x + CELL - 5, y + CELL - 8)
      ctx.textAlign = 'center'
    } else {
      ctx.fillStyle = FLYER.green
      ctx.font = `700 20px ${font}`
      ctx.fillText(String(n), cx, cy)
    }
  }

  const boxW = 560
  const boxH = 72
  const boxX = (W - boxW) / 2
  const boxY = GRID_Y + GRID + 24
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 14)
  ctx.fillStyle = FLYER.white
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = FLYER.gold
  ctx.stroke()

  ctx.fillStyle = FLYER.ink
  ctx.font = `600 17px ${font}`
  ctx.fillText('Nequi: 317 715 2317 — María Bermúdez ❤️', W / 2, boxY + boxH / 2)

  ctx.fillStyle = FLYER.gold
  ctx.font = `600 13px ${font}`
  ctx.fillText('Feria de Navidad', W / 2, H - 24)

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/png')
  })
}

const MOBILE_QUERY = '(max-width: 640px)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export default function App() {
  const isMobile = useIsMobile()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [query, setQuery] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    api('/api/asignaciones')
      .then((data) => setAssignments(data.asignaciones))
      .catch((err) => setMessage({ type: 'error', text: err.message }))
      .finally(() => setLoading(false))
  }, [])

  // El aviso desaparece solo.
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  // número -> asignación
  const owners = useMemo(() => {
    const map = new Map()
    assignments.forEach((a) => a.numeros.forEach((n) => map.set(n, a)))
    return map
  }, [assignments])

  const sortedSelected = useMemo(() => [...selected].sort((a, b) => a - b), [selected])

  const needle = fold(query.trim())
  const visible = useMemo(() => {
    return assignments.filter((a) => !needle || fold(a.nombre).includes(needle))
  }, [assignments, needle])

  const matchNumbers = useMemo(() => {
    if (!needle) return null
    const set = new Set()
    visible.forEach((a) => a.numeros.forEach((n) => set.add(n)))
    return set
  }, [visible, needle])

  // Devuelve un mensaje de error o null si se marcó bien.
  function addNumber(n) {
    if (!Number.isInteger(n) || n < 0 || n > 99) return 'Escribe un número entre 0 y 99.'
    const owner = owners.get(n)
    if (owner) return `El ${n} ya está asignado a ${owner.nombre}.`
    if (selected.has(n)) return `El ${n} ya está marcado.`
    setSelected((prev) => new Set(prev).add(n))
    return null
  }

  function unmark(n) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(n)
      return next
    })
  }

  function toggle(n) {
    if (isMobile || owners.has(n)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  async function handleSave({ nombre, contacto }) {
    const created = await api('/api/asignaciones', {
      method: 'POST',
      body: JSON.stringify({ nombre, contacto, numeros: sortedSelected }),
    })
    setAssignments((prev) => [...prev, created])
    setSelected(new Set())
    setModalOpen(false)
  }

  async function handleEditSave({ nombre, contacto, numeros }) {
    const updated = await api(`/api/asignaciones/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre, contacto, numeros }),
    })
    setAssignments((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
    setEditingId(null)
  }

  function handleDelete(id) {
    const a = assignments.find((item) => item.id === id)
    if (!a) return
    setConfirm({
      title: 'Borrar asignación',
      message: `¿Borrar la asignación de ${a.nombre}? Sus ${a.numeros.length} número(s) quedarán libres.`,
      confirmLabel: 'Borrar',
      danger: true,
      onConfirm: async () => {
        await api(`/api/asignaciones/${id}`, { method: 'DELETE' })
        setAssignments((prev) => prev.filter((item) => item.id !== id))
        setEditingId(null)
      },
    })
  }

  async function copyImage() {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('El navegador no permite copiar imágenes (requiere https o localhost).')
      }
      const blobPromise = renderBoardImage(owners)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
      setMessage({ type: 'ok', text: 'Foto copiada al portapapeles.' })
    } catch (err) {
      setMessage({ type: 'error', text: `No se pudo copiar la foto: ${err.message}` })
    }
  }

  function askExport() {
    setConfirm({
      title: 'Guardar asignaciones',
      message: `Se descargará un archivo con ${assignments.length} asignación(es) (${owners.size} números). ¿Continuar?`,
      confirmLabel: 'Guardar',
      onConfirm: exportJson,
    })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ asignaciones: assignments }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rifa-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const loaded = validateAssignments(JSON.parse(await file.text()))
      setConfirm({
        title: 'Cargar asignaciones',
        message:
          `El archivo "${file.name}" tiene ${loaded.length} asignación(es). ` +
          (assignments.length > 0
            ? 'Esto reemplazará las asignaciones actuales. ¿Continuar?'
            : '¿Cargarlas?'),
        confirmLabel: 'Cargar',
        danger: assignments.length > 0,
        onConfirm: async () => {
          const data = await api('/api/asignaciones', {
            method: 'PUT',
            body: JSON.stringify({ asignaciones: loaded }),
          })
          setAssignments(data.asignaciones)
          setSelected(new Set())
          setMessage({ type: 'ok', text: `Se cargaron ${loaded.length} asignaciones.` })
        },
      })
    } catch (err) {
      setMessage({ type: 'error', text: `No se pudo cargar el archivo: ${err.message}` })
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎄 Gran Rifa — Ancheta Navideña</h1>
        <p className="subtitle">y 200 mil pesos en efectivo · Juega el 21 de noviembre</p>
        <div className="stats">
          <span>
            Asignados: <strong>{owners.size}</strong> / 100
          </span>
          <span>
            Disponibles: <strong>{100 - owners.size}</strong>
          </span>
        </div>
      </header>

      <main className="layout">
        <section className="board-section">
          <div className="grid" role="grid" aria-label="Cuadrícula de números del 0 al 99">
            {NUMBERS.map((n) => {
              const owner = owners.get(n)
              const isSelected = selected.has(n)
              const cls = owner ? 'cell assigned' : isSelected ? 'cell selected' : 'cell'
              const found = matchNumbers?.has(n)
              return (
                <button
                  key={n}
                  type="button"
                  className={`${cls}${isMobile ? ' readonly' : ''}${found ? ' found' : ''}`}
                  onClick={() => toggle(n)}
                  disabled={!!owner}
                  tabIndex={isMobile ? -1 : undefined}
                  aria-pressed={isSelected}
                  title={owner ? `Asignado a ${owner.nombre}` : undefined}
                >
                  {owner ? <span className="mark">✕</span> : n}
                  {owner && <span className="num-small">{n}</span>}
                </button>
              )
            })}
          </div>

          {isMobile && <NumberPicker selected={sortedSelected} onAdd={addNumber} onRemove={unmark} />}

          <div className="actions">
            <button
              type="button"
              className="btn primary"
              disabled={selected.size === 0}
              onClick={() => setModalOpen(true)}
            >
              Asignar{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
            <button
              type="button"
              className="btn"
              disabled={selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              Limpiar selección
            </button>
            <button type="button" className="btn" onClick={copyImage}>
              📋 Copiar foto
            </button>
          </div>
        </section>

        <aside className="side">
          <div className="side-head">
            <h2>Asignaciones</h2>
            <div className="io">
              <button
                type="button"
                className="btn small"
                onClick={askExport}
                disabled={assignments.length === 0}
              >
                Guardar
              </button>
              <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
                Cargar
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={importJson}
              />
            </div>
          </div>

          <input
            className="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
            aria-label="Buscar asignaciones por nombre"
          />

          {loading ? (
            <p className="empty">Cargando asignaciones…</p>
          ) : assignments.length === 0 ? (
            <p className="empty">Aún no hay números asignados.</p>
          ) : visible.length === 0 ? (
            <p className="empty">Nadie coincide con «{query.trim()}».</p>
          ) : (
            <ul className="list">
              {visible.map((a) => (
                <li key={a.id} className="card">
                  <div className="card-top">
                    <strong>{a.nombre}</strong>
                    {a.contacto ? <span className="contact">{a.contacto}</span> : null}
                  </div>
                  <div className="chips">
                    {a.numeros.map((n) => (
                      <span key={n} className="chip">
                        {n}
                      </span>
                    ))}
                  </div>
                  <div className="card-actions">
                    <button type="button" className="btn small" onClick={() => setEditingId(a.id)}>
                      Editar
                    </button>
                    <button type="button" className="btn small danger" onClick={() => handleDelete(a.id)}>
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>

      {message && (
        <p className={`msg toast ${message.type}`} role="status">
          {message.text}
        </p>
      )}

      {modalOpen && (
        <AssignModal
          numbers={sortedSelected}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {editingId !== null && assignments.some((a) => a.id === editingId) && (
        <AssignModal
          editing
          initial={assignments.find((a) => a.id === editingId)}
          numbers={assignments.find((a) => a.id === editingId).numeros}
          onClose={() => setEditingId(null)}
          onSave={handleEditSave}
          onDelete={() => handleDelete(editingId)}
        />
      )}

      {confirm && (
        <ConfirmModal
          {...confirm}
          onCancel={() => setConfirm(null)}
          onAccept={() => {
            const fn = confirm.onConfirm
            setConfirm(null)
            Promise.resolve(fn()).catch((err) => setMessage({ type: 'error', text: err.message }))
          }}
        />
      )}
    </div>
  )
}

function NumberPicker({ selected, onAdd, onRemove }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function submit(e) {
    e.preventDefault()
    const raw = value.trim()
    const err = raw === '' ? 'Escribe un número entre 0 y 99.' : onAdd(Number(raw))
    setError(err ?? '')
    if (!err) setValue('')
    inputRef.current?.focus()
  }

  return (
    <form className="picker" onSubmit={submit} noValidate>
      <label htmlFor="num-input">Número a marcar (0–99)</label>
      <div className="picker-row">
        <input
          id="num-input"
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min="0"
          max="99"
          step="1"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          placeholder="Ej: 42"
        />
        <button type="submit" className="btn primary">
          Marcar
        </button>
      </div>
      {error && <span className="error" role="alert">{error}</span>}
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((n) => (
            <button
              key={n}
              type="button"
              className="chip removable"
              aria-label={`Desmarcar el número ${n}`}
              onClick={() => onRemove(n)}
            >
              {n} ✕
            </button>
          ))}
        </div>
      )}
    </form>
  )
}

function ConfirmModal({ title, message, confirmLabel = 'Aceptar', danger = false, onCancel, onAccept }) {
  useEffect(() => {
    // Captura para que Escape cierre solo este modal y no el que está debajo.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return (
    <div className="backdrop top" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p className="confirm-text">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={`btn ${danger ? 'danger-solid' : 'primary'}`} onClick={onAccept} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignModal({ numbers: initialNumbers, initial, editing = false, onClose, onSave, onDelete }) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [contacto, setContacto] = useState(initial?.contacto ?? '')
  const [numbers, setNumbers] = useState(initialNumbers)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    const name = nombre.trim()
    const phone = contacto.trim()
    if (!name) errs.nombre = 'El nombre es obligatorio.'
    if (phone && !/^\d{7,15}$/.test(phone)) errs.contacto = 'Poner un número válido.'
    if (numbers.length === 0) errs.numeros = 'Debe quedar al menos un número (o borra la asignación).'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    try {
      await onSave({ nombre: name, contacto: phone, numeros: numbers })
    } catch (err) {
      setErrors({ form: err.message })
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="modal-title" noValidate>
        <h2 id="modal-title">{editing ? 'Editar asignación' : 'Asignar números'}</h2>
        <div className="chips">
          {numbers.map((n) =>
            editing ? (
              <button
                key={n}
                type="button"
                className="chip removable"
                title="Quitar este número"
                aria-label={`Quitar el número ${n}`}
                onClick={() => setNumbers((prev) => prev.filter((x) => x !== n))}
              >
                {n} ✕
              </button>
            ) : (
              <span key={n} className="chip">
                {n}
              </span>
            ),
          )}
        </div>
        {editing && <span className="hint">Toca un número para quitarlo de esta asignación.</span>}
        {errors.numeros && <span className="error">{errors.numeros}</span>}
        {errors.form && <span className="error">{errors.form}</span>}

        <label>
          Nombre
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            autoComplete="name"
          />
          {errors.nombre && <span className="error">{errors.nombre}</span>}
        </label>

        <label>
          Número de contacto (opcional)
          <input
            type="tel"
            inputMode="numeric"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            autoComplete="tel"
            placeholder="Opcional"
          />
          {errors.contacto && <span className="error">{errors.contacto}</span>}
        </label>

        <div className="modal-actions">
          {editing && (
            <button type="button" className="btn danger push-left" onClick={onDelete}>
              Borrar
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}
