import awa, { namedParams as N, paramIndex, renderBytecode, sexpr as E } from './awa'

const { type, opcodes } = awa;
const { local, call, i32 } = awa.opcodes;

(async () => {
    // --- creating wasm module ---

    const module = awa.create()

    {
        const [a, b] = paramIndex
        awa.func(module, {
            name: 'max',
            params: N({ a: type.i32, b: type.i32 }),
            result: [type.i32],
            opcodes: [awa.if(type.i32,
                [E(i32.gt_s(), local.get(a), local.get(b))],
                [local.get(a)],
                [local.get(b)],
            )]
        })
    }

    const bytecode = awa.compile(module)
    console.log(renderBytecode(bytecode))

    // // --- running wasm module ---

    const wasm = await WebAssembly.instantiate(bytecode)
    console.log(wasm)
    console.log((wasm.instance.exports as any).max(30, 20))
    // console.log(wasm.instance.exports.wsub(0, 0))
})()
