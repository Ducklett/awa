const flatten = (xs: number[][]) => xs.reduce((acc, cur) => { acc.push(...cur); return acc }, [])
const serializeBytes = (xs: number[]) => xs.map(v => v.toString(16)).join(' ')
const deserializeBytes = (str: string) => str.split(' ').map(v => parseInt(v, 16))
const nameBytes = (name: string) => name.split('').map((v) => v.charCodeAt(0))
const renderBytecode = (xs: Uint8Array) => [...xs]
    .map(v => v.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')

const paramIndex = new Array(255).fill(null).map((_, i) => i)

type AwaFunc = { id: number, sigId: number, name?: string, opcodes: number[][] }
type AwaModule = { funcs: AwaFunc[], sigs: Map<string, number>, funcCount: number, sigCount: number }

const awa = {
    create() {
        return { funcs: [], sigs: new Map(), funcCount: 0, sigCount: 0 }
    },

    funcId(module: AwaModule) { return module.funcCount++ },

    func(module: AwaModule, { name = null, params = [], result = [], opcodes = [], id = -1 }) {

        const sigByte = 0x60
        const signature = serializeBytes([sigByte, params.length, ...params, result.length, ...result])
        const funcs = module.funcs
        const sigs = module.sigs

        if (!sigs.has(signature)) {
            sigs.set(signature, module.sigCount++)
        }

        const sigId = sigs.get(signature)

        if (id == -1) {
            id = awa.funcId(module)
        }

        funcs[id] = { id, sigId, name, opcodes }

        return id
    },

    compile({ funcs, sigs }: AwaModule) {
        const magic = [0x00, 0x61, 0x73, 0x6D] // .asm
        const version = [0x01, 0x00, 0x00, 0x00]

        const funcByte = 0x01
        let headerCount = sigs.size
        let headers = []
        let funcCount = funcs.length
        let headerIndices = []
        const exportSig = 0x07
        let exports = []
        const bodySig = 0x0A
        const bodyTerm = 0x0B
        let bodies = []

        for (let [sig, _] of sigs) {
            // const headerIndex = headerCount
            const signature = deserializeBytes(sig)
            headers.push(signature)
        }

        for (let fn of funcs) {
            headerIndices.push(fn.sigId)
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

        const bytecode = [...magic, ...version, ...funcCode]
        return new Uint8Array(bytecode)
    },

    type: {
        f64: 0x7C,
        f32: 0x7D,
        i64: 0x7E,
        i32: 0x7F,
    },

    call(id: number) { return [0x10, id] },

    local: {
        get(n: number) { return [0x20, n] }
    },

    i32: {
        const(n: number) { return [0x41, n] },
        eqz() { return [0x45] },
        eq() { return [0x46] },
        ne() { return [0x47] },
        lt_s() { return [0x48] },
        lt_u() { return [0x49] },
        gt_s() { return [0x4A] },
        gt_u() { return [0x4B] },
        le_s() { return [0x4C] },
        le_u() { return [0x4D] },
        ge_s() { return [0x4E] },
        ge_u() { return [0x4F] },

        clz() { return [0x67] },
        ctz() { return [0x68] },
        popcnt() { return [0x69] },
        add() { return [0x6A] },
        sub() { return [0x6B] },
        mul() { return [0x6C] },
        div_s() { return [0x6D] },
        div_u() { return [0x6E] },
        rem_s() { return [0x6F] },
        rem_u() { return [0x70] },
        and() { return [0x71] },
        or() { return [0x72] },
        xor() { return [0x73] },
        shl() { return [0x74] },
        shr_s() { return [0x75] },
        shr_u() { return [0x76] },
        rotl() { return [0x77] },
        rotr() { return [0x78] },
    },
};

(async () => {
    // --- creating wasm module ---

    const module = awa.create()

    const [a, b] = paramIndex
    const add = awa.funcId(module)

    awa.func(module, {
        name: 'foo',
        params: [awa.type.i32, awa.type.i32],
        result: [awa.type.i32],
        opcodes: [awa.local.get(a), awa.local.get(b), awa.call(add), awa.i32.const(2), awa.i32.add()]
    })

    awa.func(module, {
        id: add,
        params: [awa.type.i32, awa.type.i32],
        result: [awa.type.i32],
        opcodes: [awa.local.get(a), awa.local.get(b), awa.i32.add()]
    })

    const bytecode = awa.compile(module)
    console.log(renderBytecode(bytecode))

    // // --- running wasm module ---

    const wasm = await WebAssembly.instantiate(bytecode)
    console.log(wasm)
    console.log((wasm.instance.exports as any).foo(34, 35))
    // console.log(wasm.instance.exports.wsub(0, 0))
})()
