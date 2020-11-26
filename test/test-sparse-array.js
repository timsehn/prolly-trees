/* globals describe, it */
import { deepStrictEqual as same } from 'assert'
import { create } from '../src/sparse-array.js'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { nocache } from '../src/cache.js'
import { bf, simpleCompare as compare } from '../src/utils.js'

const chunker = bf(3)

const cache = nocache

const storage = () => {
  const blocks = {}
  const put = block => {
    blocks[block.cid.toString()] = block
  }
  const get = async cid => {
    const block = blocks[cid.toString()]
    if (!block) throw new Error('Not found')
    return block
  }
  return { get, put, blocks }
}

const opts = { cache, chunker, codec, hasher }

const verify = (check, node) => {
  same(check.isLeaf, node.isLeaf)
  same(check.isBranch, node.isBranch)
  same(check.entries, node.entryList.entries.length)
  same(check.closed, node.closed)
}

const createList = entries => entries.map(([key, value]) => ({ key, value }))

describe('map', () => {
  it('basic create', async () => {
    const { get, put } = storage()
    const v = 'value'
    const list = createList([
      [1, v],
      [2, v],
      [10, v],
      [15, v],
      [20, v],
      [200, v],
      [210, v],
      [290, v],
      [300, v],
      [10000, v]
    ])
    const checks = [
      [true, undefined, 2, true],
      [true, undefined, 1, true],
      [true, undefined, 1, true],
      [true, undefined, 4, true],
      [true, undefined, 2, false],
      [undefined, true, 4, true],
      [undefined, true, 1, false],
      [undefined, true, 2, true]
    ].map(([isLeaf, isBranch, entries, closed]) => ({ isLeaf, isBranch, entries, closed }))
    let root
    for await (const node of create({ get, compare, list, ...opts })) {
      const address = await node.address
      same(address.asCID, address)
      verify(checks.shift(), node)
      await put(await node.block)
      root = node
    }
    root = await root.getNode(await root.address)
    for (const { key } of list) {
      same(await root.get(key), v)
    }
  })
})