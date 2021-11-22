const PROTOCOL = '/ipfs/ping/1.0.0'
const PROTOCOL_VERSION = '1.0.0'
const PROTOCOL_NAME = 'ping'

const { pipe } = require('it-pipe')
// @ts-ignore it-buffer has no types exported
const { toBuffer } = require('it-buffer')
const { collect, take } = require('streaming-iterables')
const { equals } = require('uint8arrays/equals')

/**
 * Ping a given peer and wait for its response, getting the operation latency.
 *
 * @param {Libp2p} node
 * @param {PeerId|Multiaddr} peer
 * @returns {Promise<number>}
 */
async function ping (node, peer) {
    const protocol = `/${node._config.protocolPrefix}/${PROTOCOL_NAME}/${PROTOCOL_VERSION}`
    // @ts-ignore multiaddr might not have toB58String
    console.log('dialing %s to %s', protocol, peer.toB58String ? peer.toB58String() : peer)

    const connection = await node.dial(peer)
    const { stream } = await connection.newStream(protocol)

    const start = Date.now()
    const data = "foo"

    const [result] = await pipe(
        [data],
        stream,
        (/** @type {MuxedStream} */ stream) => take(1, stream),
        toBuffer,
        collect
    )
    const end = Date.now()

    if (!equals(data, result)) {
        new Error('Received wrong ping ack')
    }

    return end - start
}

/**
 * Subscribe ping protocol handler.
 *
 * @param {Libp2p} node
 */
function mount (node) {
    node.handle(`/${node._config.protocolPrefix}/${PROTOCOL_NAME}/${PROTOCOL_VERSION}`, ({ stream }) => pipe(stream, stream))
}

/**
 * Unsubscribe ping protocol handler.
 *
 * @param {Libp2p} node
 */
function unmount (node) {
    node.unhandle(`/${node._config.protocolPrefix}/${PROTOCOL_NAME}/${PROTOCOL_VERSION}`)
}

module.exports.mount = mount
module.exports.unmount = unmount
module.exports.ping = ping