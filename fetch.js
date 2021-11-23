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

    const request = new FetchRequest({identifier: key})

    // send message
    await pipe(
        [FetchRequest.encode(request).finish()],
        lp.encode(),
        stream,
        consume
    )

    await delay(1000)

    // read response
    let response
    try {
        const [data] = await pipe(
            [],
            stream,
            lp.decode(),
            take(1),
            toBuffer,
            collect
        )
        if (!data) {
            throw new Error("no data received: " + data)
        }
        response = FetchResponse.decode(data)
    } catch (err) {
        //console.error('received invalid message', err)
        throw err
    }

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
        console.log("Received valid Fetch request for data we have")
    } else {
        response = new FetchResponse({status: FetchResponse.StatusCode.NOT_FOUND})
        console.log("Received valid Fetch request for data we don't have")
    }

    await pipe(
        [FetchResponse.encode(response).finish()],
        lp.encode(),
        stream,
        consume
    )
    console.log('response sent')
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