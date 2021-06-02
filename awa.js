const flatten = xs => xs.reduce((acc, cur) => { acc.push(...cur); return acc }, [])
const serializeBytes = xs => xs.map(v => v.toString(16)).join(' ')
const deserializeBytes = str => str.split(' ').map(v => parseInt(v, 16))
const nameBytes = name => name.split('').map((v) => v.charCodeAt(0))
const renderBytecode = xs => [...xs].map(v => v.toString(16).toUpperCase().padStart(2, '0')).join(' ')

const paramIndex = new Array(255).fill(null).map((_, i) => i)

const awa = {
    create() {
        return { funcs: new Map(), funcCount: 0 }
    },
    funcId(module) { return module.funcCount++ },
    func(module, { name = null, params = [], result = [], opcodes = [], id = -1 }) {

        const sigByte = 0x60
        const signature = serializeBytes([sigByte, params.length, ...params, result.length, ...result])
        const funcs = module.funcs
        if (id == -1) id = awa.funcId(module)

        if (!funcs.has(signature)) {
            funcs.set(signature, [])
        }

        funcs.get(signature).push({ id, name, opcodes })

        return id
    },
    compile({ funcs }) {
        const magic = [0x00, 0x61, 0x73, 0x6D] // .asm
        const module = [0x01, 0x00, 0x00, 0x00]

        const funcByte = 0x01
        let headerCount = 0
        let headers = []
        let funcCount = 0
        let headerIndices = []
        const exportSig = 0x07
        let exports = []
        const bodySig = 0x0A
        const bodyTerm = 0x0B
        let bodies = []

        for (let [sig, fns] of funcs) {
            const headerIndex = headerCount
            const signature = deserializeBytes(sig)
            headers.push(signature)
            console.log(fns)
            for (let fn of fns) {
                headerIndices.push(headerIndex)
                if (fn.name) {
                    const bytes = nameBytes(fn.name)
                    exports.push([bytes.length, ...bytes, 0x00, fn.id])
                }

                {
                    const bytes = flatten(fn.opcodes)
                    const bodyLen = bytes.length + 2
                    bodies.push([bodyLen, 0x00, ...bytes, bodyTerm])
                }
            }
            headerCount++
            funcCount += fns.length
        }

        const flatHeaders = flatten(headers)
        const headerLen = 1 + flatHeaders.length

        const flatExports = flatten(exports)
        const exportLen = 1 + flatExports.length
        const exportsCount = exports.length

        const flatBodies = flatten(bodies)
        const bodiesLen = 1 + flatBodies.length
        const bodiesCount = bodies.length

        const funcCode = [
            funcByte, headerLen, headerCount, ...flatHeaders,
            0x03, funcCount + 1, funcCount, ...headerIndices,
            exportSig, exportLen, exportsCount, ...flatExports,
            bodySig, bodiesLen, bodiesCount, ...flatBodies
        ]

        const bytecode = [...magic, ...module, ...funcCode]
        return new Uint8Array(bytecode)
    },

    type: {
        f64: 0x7C,
        f32: 0x7D,
        i64: 0x7E,
        i32: 0x7F,
    },

    local: {
        get(n) { return [0x20, n] }
    },
    i32: {
        const(n) { return [0x41, n] },
        eq() { return [0x46] },
        ne() { return [0x47] },
        le_s() { return [0x4C] },
        le_u() { return [0x4D] },
        ge_s() { return [0x4E] },
        ge_u() { return [0x4F] },
        add() { return [0x6A] },
        sub() { return [0x6B] },
        mul() { return [0x6C] },
        div_s() { return [0x6D] },
        div_u() { return [0x6E] },
        rem_s() { return [0x6F] },
        rem_u() { return [0x70] },
        and() { return [0x71] },
        and() { return [0x72] },
        xor() { return [0x73] },
        shl() { return [0x74] },
        shr_s() { return [0x75] },
        shr_u() { return [0x76] },
    },
};

(async () => {
    // --- creating wasm module ---

    const module = awa.create()

    const [a, b] = paramIndex
    awa.func(module, {
        name: 'wadd',
        params: [awa.type.i32, awa.type.i32],
        result: [awa.type.i32],
        opcodes: [awa.local.get(a), awa.local.get(b), awa.i32.add()]
    })

    awa.func(module, {
        name: 'wsub',
        params: [awa.type.i32, awa.type.i32],
        result: [awa.type.i32],
        opcodes: [awa.local.get(a), awa.local.get(b), awa.i32.sub()]
    })

    const bytecode = awa.compile(module)
    console.log(renderBytecode(bytecode))

    // // --- running wasm module ---

    const wasm = await WebAssembly.instantiate(bytecode)
    console.log(wasm)
    console.log(wasm.instance.exports.wadd(10, 20))
    console.log(wasm.instance.exports.wsub(10, 20))
    // console.log(wasm.instance.exports.wsub(0, 0))
})()
