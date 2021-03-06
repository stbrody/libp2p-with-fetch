const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const Mplex = require('libp2p-mplex')
const Fetch = require("./fetch");
const { NOISE } = require('libp2p-noise')
const Bootstrap = require('libp2p-bootstrap')
const MDNS = require('libp2p-mdns')

async function createLibp2pNode() {
    const libp2p = await Libp2p.create({
        addresses: {
            listen: [
                '/ip4/0.0.0.0/tcp/0',
                '/ip4/0.0.0.0/tcp/0/ws',
                `/ip4/127.0.0.1/tcp/15555/ws/p2p-webrtc-star/`
            ]
        },
        modules: {
            transport: [ TCP ],
            streamMuxer: [ Mplex ],
            connEncryption: [ NOISE ],
            peerDiscovery: [Bootstrap, MDNS],
        },
        config: {
            peerDiscovery: {
                bootstrap: {
                    list: ['/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN', '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa', '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb', '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt', '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ']
                }
            },
            dht: {
                enabled: false,
            }
        }
    })

    libp2p.connectionManager.on('peer:connect', (connection) => {
        //console.info(`Connected to ${connection.remotePeer.toB58String()}!`)
    })

    // Start libp2p
    await libp2p.start()

    console.log(`libp2p node started with peerId: ${libp2p.peerId.toB58String()}`)

    return libp2p
}

async function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}



async function main() {
    const node1 = await createLibp2pNode()
    const node2 = await createLibp2pNode()

    await delay(2000)

    Fetch.mount(node1)
    Fetch.mount(node2)

    const val1 = await Fetch.fetch(node1, node2.peerId, "bar")
    console.log("Received value: " + val1)
    const val2 = await Fetch.fetch(node2, node1.peerId, "garbage")
    console.log("Received what should be null: " + val2)

    await node1.stop()
    await node2.stop()
}



main().finally(() => {
    console.log("DONE")
})
