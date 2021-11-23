const PROTOCOL_VERSION = '0.0.1'
const PROTOCOL_NAME = 'fetch'

const { pipe } = require('it-pipe')
// @ts-ignore it-buffer has no types exported
const { toBuffer } = require('it-buffer')
const { collect, take, consume } = require('streaming-iterables')
const lp = require('it-length-prefixed')
const { FetchRequest, FetchResponse } = require('./message')
// @ts-ignore it-handshake does not export types
const handshake = require('it-handshake')


const DATA = {
    foo: 'hello world!',
    bar: 'yay it works!',
}

async function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}

/**
 * TODO
 *
 * @param {Libp2p} node
 * @param {PeerId|Multiaddr} peer
 * @param {string} key
 * @returns {Promise<number>}
 */
async function fetch (node, peer, key) {
    const protocol = `/${node._config.protocolPrefix}/${PROTOCOL_NAME}/${PROTOCOL_VERSION}`
    // @ts-ignore multiaddr might not have toB58String
    console.log('dialing %s to %s', protocol, peer.toB58String ? peer.toB58String() : peer)

    const connection = await node.dial(peer)
    const { stream } = await connection.newStream(protocol)
    const shake = handshake(stream)

    // send message
    const request = new FetchRequest({identifier: key})
    shake.write(lp.encode.single(FetchRequest.encode(request).finish()))

    // read response
    const response = FetchResponse.decode((await lp.decode.fromReader(shake.reader).next()).value.slice())
    switch (response.status) {
        case (FetchResponse.StatusCode.OK): {
            return new TextDecoder().decode(response.data)
        }
        case (FetchResponse.StatusCode.NOT_FOUND): {
            return null
        }
        case (FetchResponse.StatusCode.ERROR): {
            throw new Error(`Error in fetch protocol response`)
        }
    }
}

async function handleRequest({stream}) {
    const shake = handshake(stream)
    const request = FetchRequest.decode((await lp.decode.fromReader(shake.reader).next()).value.slice())

    let response
    console.log(`Received valid Fetch request for key '${request.identifier}'`)
    if (DATA[request.identifier]) {
        const data = new TextEncoder().encode(DATA[request.identifier])
        response = new FetchResponse({status: FetchResponse.StatusCode.OK, data})
    } else {
        response = new FetchResponse({status: FetchResponse.StatusCode.NOT_FOUND})
    }

    shake.write(lp.encode.single(FetchResponse.encode(response).finish()))
}

/**
 * Subscribe fetch protocol handler.
 *
 * @param {Libp2p} node
 */
function mount (node) {
    node.handle(`/${node._config.protocolPrefix}/${PROTOCOL_NAME}/${PROTOCOL_VERSION}`, handleRequest)
}

/**
 * Unsubscribe fetch protocol handler.
 *
 * @param {Libp2p} node
 */
function unmount (node) {
    node.unhandle(`/${node._config.protocolPrefix}/${PROTOCOL_NAME}/${PROTOCOL_VERSION}`)
}

module.exports.mount = mount
module.exports.unmount = unmount
module.exports.fetch = fetch