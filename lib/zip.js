// A .docx, an .epub and an .odt are all the same thing: a ZIP with markup
// inside. **Node carries both directions out of the standard library** —
// inflateRaw and deflateRaw have always been there, and zlib.crc32 since Node
// 20.12. Measured in Electron 43.3.0 (Node 24.18.1): all three are present. So
// this is no third dependency; what is left is the container — local file
// header, central directory, end of central directory.
//
// **Only what a .docx and an .epub actually use:** deflate and store. No
// encryption, no ZIP64, no .doc. A password-protected file is recognised and
// not opened — see task 01 of roadmap 02.
//
// Without a window, like spelling.js and grammar.js.

const zlib = require('node:zlib')

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

// **The lid against the ZIP bomb.** One is 40 KB large and 4 GB unpacked, and
// we unpack whatever somebody drags into the window. Both limits can be read
// out of the directory before a single byte is inflated; the third guard
// counts what really arrived, because a directory that declares nothing would
// otherwise get the whole lid handed to it once per entry.
const MOST_BYTES = 256 * 1024 * 1024
const MOST_FILES = 10000

// The end of central directory is the only part at a knowable place: at the
// very end, unless the archive carries a comment. Searched backwards from
// there, because a comment may itself contain the signature.
function findEnd (buf) {
  const least = Math.max(0, buf.length - 0xFFFF - 22)
  for (let at = buf.length - 22; at >= least; at--) {
    if (buf.readUInt32LE(at) === EOCD) return at
  }
  return -1
}

// **Read from the central directory, not from the front.** The directory is
// the truth about what is in the archive; the local headers are allowed to
// carry zeroes for their sizes and hand the real ones over in a data
// descriptor afterwards.
//
// What comes back is a Map of name to Buffer, or an error with a name — a file
// that simply stays shut explains nothing to the author.
// **A file that is not a ZIP but is often mistaken for one.** Both a .doc and a
// password-protected .docx are OLE compound files — Word encrypts the whole
// container rather than setting the encryption bit inside a ZIP, so the flag in
// the directory never comes into play and the answer would otherwise be the
// unhelpful "this is not a ZIP". Measured against a real Word 16 file saved
// with a password. See task 05 of roadmap 02.
const OLE = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])

function unzip (data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (buf.length >= 8 && buf.subarray(0, 8).equals(OLE)) return { error: { code: 'ole' } }
  if (buf.length < 22) return { error: { code: 'noZip' } }

  const end = findEnd(buf)
  if (end < 0) return { error: { code: 'noZip' } }

  const count = buf.readUInt16LE(end + 10)
  const size = buf.readUInt32LE(end + 12)
  const start = buf.readUInt32LE(end + 16)

  // ZIP64 announces itself by filling exactly these fields with ones. We do
  // not read it, and we say which of the two it is.
  if (count === 0xFFFF || size === 0xFFFFFFFF || start === 0xFFFFFFFF) {
    return { error: { code: 'zip64' } }
  }
  if (count > MOST_FILES) return { error: { code: 'tooMany' } }
  if (start + size > buf.length) return { error: { code: 'broken' } }

  const files = new Map()
  let at = start
  let total = 0

  for (let n = 0; n < count; n++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== CENTRAL) {
      return { error: { code: 'broken' } }
    }
    const flags = buf.readUInt16LE(at + 8)
    const method = buf.readUInt16LE(at + 10)
    const crc = buf.readUInt32LE(at + 16)
    const packed = buf.readUInt32LE(at + 20)
    const plain = buf.readUInt32LE(at + 24)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const where = buf.readUInt32LE(at + 42)
    if (at + 46 + nameLen > buf.length) return { error: { code: 'broken' } }

    // Bit 11 says the name is UTF-8. Without it it is CP437 — for a .docx and
    // an .epub that is ASCII, and latin1 is the closer guess for the rest.
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', at + 46, at + 46 + nameLen)
    at += 46 + nameLen + extraLen + commentLen

    // Bit 0 is the password, and it is the whole archive's answer: one
    // encrypted entry means this file was not meant to be read by us.
    if (flags & 1) return { error: { code: 'encrypted' } }

    // A folder entry carries no bytes and needs none.
    if (name.endsWith('/')) continue

    total += plain
    if (total > MOST_BYTES) return { error: { code: 'tooBig' } }

    if (where + 30 > buf.length || buf.readUInt32LE(where) !== LOCAL) {
      return { error: { code: 'broken' } }
    }
    // **The local header carries its own two lengths**, and they are allowed
    // to differ from the directory's — which is why the data offset is read
    // here and never counted forward from the entry before.
    const from = where + 30 + buf.readUInt16LE(where + 26) + buf.readUInt16LE(where + 28)
    if (from + packed > buf.length) return { error: { code: 'broken' } }
    const raw = buf.subarray(from, from + packed)

    let body
    if (method === 0) {
      body = Buffer.from(raw)
    } else if (method === 8) {
      // **The room that is left, and it is measured room** — `total` carries
      // what the entries before this one really unpacked, not what they said.
      // A directory declaring nothing used to hand every entry the whole lid.
      const room = MOST_BYTES - (total - plain)
      if (room < 1) return { error: { code: 'tooBig' } }
      try {
        body = zlib.inflateRawSync(raw, { maxOutputLength: room })
      } catch (thrown) {
        // Stopping at the lid is not a damaged file, and the two answers are
        // not interchangeable to whoever reads them: zlib says which it is.
        if (thrown.code === 'ERR_BUFFER_TOO_LARGE') return { error: { code: 'tooBig' } }
        return { error: { code: 'broken', name } }
      }
    } else {
      return { error: { code: 'method', name, method } }
    }

    // **What arrived, not what was claimed.** The count above came out of the
    // directory; this is the correction, and it is what the next entry's room
    // is measured against. A stored entry is counted here too — it never had a
    // lid of its own.
    total += body.length - plain
    if (total > MOST_BYTES) return { error: { code: 'tooBig' } }

    // The one number a ZIP entry carries about itself, and we get it for free.
    // Truncated downloads and half-synced files fail exactly here.
    if (zlib.crc32(body) !== crc) return { error: { code: 'crc', name } }

    files.set(name, body)
  }

  return { files }
}

// DOS time: seconds in twos, and the year counts from 1980.
function dosStamp (date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  }
}

// **Word must read what we write**, not merely our own reader. Two things
// follow, and neither is optional:
//
//   * The entries stand in the order they are handed over. `[Content_Types].xml`
//     goes first — Word is particular about it.
//   * An entry may ask for `store` on its own. An EPUB prescribes `mimetype` as
//     the first entry and unpacked.
//
// Nothing is checked here: what arrives comes out of our own exporter, not off
// a disk. The trust boundary is unzip() above, and that one checks everything.
function zip (entries) {
  const now = dosStamp(new Date())
  const parts = []
  const dir = []
  let at = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const body = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)
    const packed = entry.store ? body : zlib.deflateRawSync(body, { level: 9 })
    const method = entry.store ? 0 : 8
    const crc = zlib.crc32(body)

    const head = Buffer.alloc(30)
    head.writeUInt32LE(LOCAL, 0)
    head.writeUInt16LE(20, 4)       // needs version 2.0 — deflate
    head.writeUInt16LE(0x800, 6)    // the names are UTF-8
    head.writeUInt16LE(method, 8)
    head.writeUInt16LE(now.time, 10)
    head.writeUInt16LE(now.date, 12)
    head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(packed.length, 18)
    head.writeUInt32LE(body.length, 22)
    head.writeUInt16LE(name.length, 26)
    head.writeUInt16LE(0, 28)       // no extra field

    const entryHead = Buffer.alloc(46)
    entryHead.writeUInt32LE(CENTRAL, 0)
    entryHead.writeUInt16LE(20, 4)  // made by version 2.0
    head.copy(entryHead, 6, 4, 30)  // version needed through name length
    entryHead.writeUInt16LE(0, 32)  // no comment
    entryHead.writeUInt16LE(0, 34)  // one disk
    entryHead.writeUInt16LE(0, 36)  // binary
    entryHead.writeUInt32LE(0, 38)  // no attributes of its own
    entryHead.writeUInt32LE(at, 42)

    parts.push(head, name, packed)
    dir.push(entryHead, name)
    at += head.length + name.length + packed.length
  }

  const size = dir.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(EOCD, 0)
  end.writeUInt16LE(0, 4)           // this disk
  end.writeUInt16LE(0, 6)           // the directory is on it
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(size, 12)
  end.writeUInt32LE(at, 16)
  end.writeUInt16LE(0, 20)          // no archive comment

  return Buffer.concat([...parts, ...dir, end])
}

module.exports = { unzip, zip, MOST_BYTES, MOST_FILES }
