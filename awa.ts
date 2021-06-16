type AwaOpcode = number[]
type AwaFunc = { id: number, sigId: number, name?: string, locals: number[], opcodes: AwaOpcode[] }
type AwaImport = { id: number, sigId: number, path: string[] }
type AwaModule = {
    // array of all the functions defined in the module
    funcs: AwaFunc[],
    // array of all the imports defined in the module
    imports: AwaImport[],
    // lookup table of id => module entry
    lut: (AwaFunc | AwaImport)[],
    // call signatures
    sigs: Map<string, number>,
    // amount of functions+imports in the module 
    funcCount: number,
    // amount of call signatures in the module
    sigCount: number,
}

const flatten = (xs: number[][]) => xs.reduce((acc, cur) => { acc.push(...cur); return acc }, [])
const serializeBytes = (xs: number[]) => xs.map(v => v.toString(16)).join(' ')
const deserializeBytes = (str: string) => str.split(' ').map(v => parseInt(v, 16))
const nameBytes = (name: string) => name.split('').map((v) => v.charCodeAt(0))
export const renderBytecode = (xs: Uint8Array) => [...xs]
    .map(v => v.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')

/** (+,10,20) => 10 20 push  */
export const sexpr = (f: AwaOpcode, ...xs: AwaOpcode[]): number[] => [...flatten(xs), ...f]
/**allows naming of parameters for readablility sake, strips names and returns an array of the values  */
export const namedParams = (obj) => Object.values(obj)

export const paramIndex = new Array(255).fill(null).map((_, i) => i)

const awa = {
    create() {
        return { funcs: [], imports: [], lut: [], sigs: new Map(), funcCount: 0, sigCount: 0 }
    },

    funcId(module: AwaModule) { return module.funcCount++ },

    signature(module: AwaModule, params: number[], result: number[]) {
        const sigByte = 0x60
        const signature = serializeBytes([sigByte, params.length, ...params, result.length, ...result])

        if (!module.sigs.has(signature)) {
            module.sigs.set(signature, module.sigCount++)
        }

        return module.sigs.get(signature)
    },

    import(module: AwaModule, { path = [], params = [], result = [], id = -1 }) {
        const sigId = awa.signature(module, params, result)

        if (id == -1) {
            id = awa.funcId(module)
        }

        const mod = { id, sigId, path }
        module.imports.push(mod)
        module.lut[id] = mod

        return id
    },

    func(module: AwaModule, { name = null, params = [], result = [], locals = [], opcodes = [], id = -1 }) {

        const sigId = awa.signature(module, params, result)

        if (id == -1) {
            id = awa.funcId(module)
        }

        const fn = { id, sigId, name, locals, opcodes }
        module.funcs.push(fn)
        module.lut[id] = fn

        return id
    },

    compile({ funcs, imports, lut, sigs }: AwaModule) {
        const magic = [0x00, 0x61, 0x73, 0x6D] // .asm
        const version = [0x01, 0x00, 0x00, 0x00]

        const funcByte = 0x01
        let headerCount = sigs.size
        let headers = []
        let funcCount = funcs.length
        let headerIndices = []
        const importSig = 0x02
        let importDefs: number[][] = []
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

        for (let im of imports) {
            const pathBytes = im.path.map(segment => [segment.length, ...nameBytes(segment)])
            console.log(pathBytes)
            importDefs.push([...flatten(pathBytes), 0x00, im.sigId])
        }

        for (let fn of funcs) {
            headerIndices.push(fn.sigId)
            if (fn.name) {
                const bytes = nameBytes(fn.name)
                exports.push([bytes.length, ...bytes, 0x00, fn.id])
            }

            {
                // converts array of local types [i32,i64,...] to binary format [segments, typecount, type, typecount, type,...]
                function packLocals(locals: number[]) {
                    let types = [locals[0]]
                    let count = [0]
                    let i = 0
                    for (let local of locals) {
                        if (types[i] != local) {
                            types.push(local)
                            count.push(1)
                            i++
                        } else {
                            count[i]++
                        }
                    }
                    return [types.length, ...flatten(types.map((t, i) => [count[i], t]))]
                }
                const bytes = flatten(fn.opcodes)
                const locals = fn.locals.length == 0 ? [0x00] : packLocals(fn.locals)
                const bodyLen = locals.length + bytes.length + 1
                bodies.push([bodyLen, ...locals, ...bytes, bodyTerm])
            }
        }

        const flatHeaders = flatten(headers)
        const headerLen = 1 + flatHeaders.length

        const flatImports = flatten(importDefs)
        const importLen = 1 + flatImports.length
        const importCount = importDefs.length

        const flatExports = flatten(exports)
        const exportLen = 1 + flatExports.length
        const exportsCount = exports.length

        const flatBodies = flatten(bodies)
        const bodiesLen = 1 + flatBodies.length
        const bodiesCount = bodies.length

        const headerCode = headerCount == 0 ? [] : [funcByte, headerLen, headerCount, ...flatHeaders]
        const importCode = importCount == 0 ? [] : [importSig, importLen, importCount, ...flatImports]

        const funcCode = [
            0x03, funcCount + 1, funcCount, ...headerIndices,
            exportSig, exportLen, exportsCount, ...flatExports,
            bodySig, bodiesLen, bodiesCount, ...flatBodies
        ]

        const bytecode = [...magic, ...version, ...headerCode, ...importCode, ...funcCode]
        return new Uint8Array(bytecode)
    },

    type: {
        empty: 0x40,
        f64: 0x7C,
        f32: 0x7D,
        i64: 0x7E,
        i32: 0x7F,
    },

    if(type: number, condition: AwaOpcode[], then: AwaOpcode[], els: AwaOpcode[] = []) {
        if (els.length) {
            return [
                ...flatten(condition),
                ...awa.opcodes.if(type),
                ...flatten(then),
                ...awa.opcodes.else(),
                ...flatten(els),
                ...awa.opcodes.end(),
            ]
        } else {
            return [
                ...flatten(condition),
                ...awa.opcodes.if(type),
                ...flatten(then),
                ...awa.opcodes.end(),
            ]
        }
    },

    opcodes: {
        unreachable() { return [0x00,] },
        nop() { return [0x01,] },
        block(bt) { return [0x02, bt] },
        loop(bt) { return [0x03, bt] },
        if(bt) { return [0x04, bt] },
        else() { return [0x05,] },
        end() { return [0x0B,] },
        br(l) { return [0x0C, l] },
        br_if(l) { return [0x0D, l] },
        br_table() { return [0x0E,] },
        return() { return [0x0F,] },
        call(x) { return [0x10, x] },
        call_indirect(x) { return [0x11, x] },
        drop() { return [0x1A,] },
        select() { return [0x1B,] },
        selectv(t) { return [0x1C, t] },
        local: {
            get(x) { return [0x20, x] },
            set(x) { return [0x21, x] },
            tee(x) { return [0x22, x] }
        },
        global: {
            get(x) { return [0x23, x] },
            set(x) { return [0x24, x] }
        },
        table: {
            get(x) { return [0x25, x] },
            set(x) { return [0x26, x] },
            init(x) { return [0xFC, 0x0C, x] },
            copy(x) { return [0xFC, 0x0E, x] },
            grow(x) { return [0xFC, 0x0F, x] },
            size(x) { return [0xFC, 0x10, x] },
            fill(x) { return [0xFC, 0x11, x] }
        },
        i32: {
            load(memarg) { return [0x28, memarg] },
            load8_s(memarg) { return [0x2C, memarg] },
            load8_u(memarg) { return [0x2D, memarg] },
            load16_s(memarg) { return [0x2E, memarg] },
            load16_u(memarg) { return [0x2F, memarg] },
            store(memarg) { return [0x36, memarg] },
            store8(memarg) { return [0x3A, memarg] },
            store16(memarg) { return [0x3B, memarg] },
            const(i32) { return [0x41, i32] },
            eqz() { return [0x45,] },
            eq() { return [0x46,] },
            ne() { return [0x47,] },
            lt_s() { return [0x48,] },
            lt_u() { return [0x49,] },
            gt_s() { return [0x4A,] },
            gt_u() { return [0x4B,] },
            le_s() { return [0x4C,] },
            le_u() { return [0x4D,] },
            ge_s() { return [0x4E,] },
            ge_u() { return [0x4F,] },
            clz() { return [0x67,] },
            ctz() { return [0x68,] },
            popcnt() { return [0x69,] },
            add() { return [0x6A,] },
            sub() { return [0x6B,] },
            mul() { return [0x6C,] },
            div_s() { return [0x6D,] },
            div_u() { return [0x6E,] },
            rem_s() { return [0x6F,] },
            rem_u() { return [0x70,] },
            and() { return [0x71,] },
            or() { return [0x72,] },
            xor() { return [0x73,] },
            shl() { return [0x74,] },
            shr_s() { return [0x75,] },
            shr_u() { return [0x76,] },
            rotl() { return [0x77,] },
            rotr() { return [0x78,] },
            wrap_i64() { return [0xA7,] },
            trunc_f32_s() { return [0xA8,] },
            trunc_f32_u() { return [0xA9,] },
            trunc_f64_s() { return [0xAA,] },
            trunc_f64_u() { return [0xAB,] },
            reinterpret_f32() { return [0xBC,] },
            extend8_s() { return [0xC0,] },
            extend16_s() { return [0xC1,] },
            trunc_sat_f32_s() { return [0xFC, 0x00,] },
            trunc_sat_f32_u() { return [0xFC, 0x01,] },
            trunc_sat_f64_s() { return [0xFC, 0x02,] },
            trunc_sat_f64_u() { return [0xFC, 0x03,] }
        },
        i64: {
            load(memarg) { return [0x29, memarg] },
            load8_s(memarg) { return [0x30, memarg] },
            load8_u(memarg) { return [0x31, memarg] },
            load16_s(memarg) { return [0x32, memarg] },
            load16_u(memarg) { return [0x33, memarg] },
            load32_s(memarg) { return [0x34, memarg] },
            load32_u(memarg) { return [0x35, memarg] },
            store(memarg) { return [0x37, memarg] },
            store8(memarg) { return [0x3C, memarg] },
            store16(memarg) { return [0x3D, memarg] },
            store32(memarg) { return [0x3E, memarg] },
            const(i64) { return [0x42, i64] },
            eqz() { return [0x50,] },
            eq() { return [0x51,] },
            ne() { return [0x52,] },
            lt_s() { return [0x53,] },
            lt_u() { return [0x54,] },
            gt_s() { return [0x55,] },
            gt_u() { return [0x56,] },
            le_s() { return [0x57,] },
            le_u() { return [0x58,] },
            ge_s() { return [0x59,] },
            ge_u() { return [0x5A,] },
            clz() { return [0x79,] },
            ctz() { return [0x7A,] },
            popcnt() { return [0x7B,] },
            add() { return [0x7C,] },
            sub() { return [0x7D,] },
            mul() { return [0x7E,] },
            div_s() { return [0x7F,] },
            div_u() { return [0x80,] },
            rem_s() { return [0x81,] },
            rem_u() { return [0x82,] },
            and() { return [0x83,] },
            or() { return [0x84,] },
            xor() { return [0x85,] },
            shl() { return [0x86,] },
            shr_s() { return [0x87,] },
            shr_u() { return [0x88,] },
            rotl() { return [0x89,] },
            rotr() { return [0x8A,] },
            extend_i32_s() { return [0xAC,] },
            extend_i32_u() { return [0xAD,] },
            trunc_f32_s() { return [0xAE,] },
            trunc_f32_u() { return [0xAF,] },
            trunc_f64_s() { return [0xB0,] },
            trunc_f64_u() { return [0xB1,] },
            reinterpret_f64() { return [0xBD,] },
            extend8_s() { return [0xC2,] },
            extend16_s() { return [0xC3,] },
            extend32_s() { return [0xC4,] },
            trunc_sat_f32_s() { return [0xFC, 0x04,] },
            trunc_sat_f32_u() { return [0xFC, 0x05,] },
            trunc_sat_f64_s() { return [0xFC, 0x06,] },
            trunc_sat_f64_u() { return [0xFC, 0x07,] },
        },
        f32: {
            load(memarg) { return [0x2A, memarg] },
            store(memarg) { return [0x38, memarg] },
            const(f32) { return [0x43, f32] },
            eq() { return [0x5B,] },
            ne() { return [0x5C,] },
            lt() { return [0x5D,] },
            gt() { return [0x5E,] },
            le() { return [0x5F,] },
            ge() { return [0x60,] },
            abs() { return [0x8B,] },
            neg() { return [0x8C,] },
            ceil() { return [0x8D,] },
            floor() { return [0x8E,] },
            trunc() { return [0x8F,] },
            nearest() { return [0x90,] },
            sqrt() { return [0x91,] },
            add() { return [0x92,] },
            sub() { return [0x93,] },
            mul() { return [0x94,] },
            div() { return [0x95,] },
            min() { return [0x96,] },
            max() { return [0x97,] },
            copysign() { return [0x98,] },
            convert_i32_s() { return [0xB2,] },
            convert_i32_u() { return [0xB3,] },
            convert_i64_s() { return [0xB4,] },
            convert_i64_u() { return [0xB5,] },
            demote_f64() { return [0xB6,] },
            reinterpret_i32() { return [0xBE,] }
        },
        f64: {
            load(memarg) { return [0x2B, memarg] },
            store(memarg) { return [0x39, memarg] },
            const(f64) { return [0x44, f64] },
            eq() { return [0x61,] },
            ne() { return [0x62,] },
            lt() { return [0x63,] },
            gt() { return [0x64,] },
            le() { return [0x65,] },
            ge() { return [0x66,] },
            abs() { return [0x99,] },
            neg() { return [0x9A,] },
            ceil() { return [0x9B,] },
            floor() { return [0x9C,] },
            trunc() { return [0x9D,] },
            nearest() { return [0x9E,] },
            sqrt() { return [0x9F,] },
            add() { return [0xA0,] },
            sub() { return [0xA1,] },
            mul() { return [0xA2,] },
            div() { return [0xA3,] },
            min() { return [0xA4,] },
            max() { return [0xA5,] },
            copysign() { return [0xA6,] },
            convert_i32_s() { return [0xB7,] },
            convert_i32_u() { return [0xB8,] },
            convert_i64_s() { return [0xB9,] },
            convert_i64_u() { return [0xBA,] },
            promote_f32() { return [0xBB,] },
            reinterpret_i64() { return [0xBF,] }
        },
        memory: {
            size() { return [0x3F,] },
            grow() { return [0x40,] },
            init(x) { return [0xFC, 0x08, x] },
            copy() { return [0xFC, 0x0A,] },
            fill() { return [0xFC, 0x0B,] }
        },
        ref: {
            null(t) { return [0xD0, t] },
            is_null() { return [0xD1,] },
            func(x) { return [0xD2, x] }
        },
        data: {
            drop(x) { return [0xFC, 0x09, x] }
        },
        elem: {
            drop(x) { return [0xFC, 0x0D, x] }
        }
    }
};

export default awa;
