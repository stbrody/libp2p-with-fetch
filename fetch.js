const PROTOCOL = '/libp2p/fetch/0.0.1'
const PROTOCOL_VERSION = '0.0.1'
const PROTOCOL_NAME = 'fetch'

const { pipe } = require('it-pipe')
// @ts-ignore it-buffer has no types exported
const { toBuffer } = require('it-buffer')
const { collect, take, consume } = require('streaming-iterables')
const lp = require('it-length-prefixed')
const { FetchRequest, FetchResponse } = require('./message')


const DATA = {
    foo: 'yay',
    bar: 'it',
    baz: 'works!'
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

    const request = new FetchRequest({identifier: key})

    const [result] = await pipe(
        [FetchRequest.encode(request).finish()],
        lp.encode(),
        stream,
        ( stream) => take(1, stream),
        //toBuffer,
        collect
    )

    const response = FetchResponse.decode(result)
    switch (response.status) {
        case (FetchResponse.StatusCode.OK): {
            return response.data
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
    let request
    try {
        const [data] = await pipe(
            [],
            stream,
            lp.decode(),
            take(1),
            toBuffer,
            collect
        )
        request = FetchRequest.decode(data)
    } catch (err) {
        return console.error('received invalid message', err)
    }

    let response
    if (DATA[request.identifier]) {
        response = new FetchResponse({status: FetchResponse.StatusCode.OK, data: DATA[request.identifier]})
    } else {
        response = new FetchResponse({status: FetchResponse.StatusCode.NOT_FOUND})
    }

    await pipe(
        [FetchResponse.encode(response).finish()],
        lp.encode(),
        stream,
        consume
    )
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