import execa from 'execa'
import splitLines from 'split-lines'
import { createParser } from 'parse-pairs'

// ===================================================================

const parse = createParser({
  keyTransform: key => key.slice(5).toLowerCase(),
})
const makeFunction = command => async (fields, ...args) => {
  return splitLines(
    await execa.stdout(command, [
      '--noheading',
      '--nosuffix',
      '--nameprefixes',
      '--unbuffered',
      '--units',
      'b',
      '-o',
      String(fields),
      ...args,
    ])
  ).map(Array.isArray(fields) ? parse : line => parse(line)[fields])
}

export const lvs = makeFunction('lvs')
export const pvs = makeFunction('pvs')
