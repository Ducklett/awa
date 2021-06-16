import awa, { namedParams as N, paramIndex, renderBytecode, sexpr as E } from './awa'

const { type, opcodes } = awa;
const { local, call, i32 } = awa.opcodes;

(async () => {
    // --- creating wasm module ---

    const module = awa.create()

    awa.memory(module, { name: "mem", pages: 1, maxPages: 4 })

    const consoleLog = awa.import(module, { path: ['console', 'log'], params: [type.i32] })

    {
        const [a] = paramIndex
        awa.func(module, {
            name: 'foo',
            params: N({ a: type.i32 }),
            locals: [type.i32, type.i64, type.i32],
            opcodes: [
                // awa.if(type.empty,
                //     [E(i32.gt_s(), local.get(a), i32.const(10))],
                //     [E(opcodes.call(consoleLog), local.get(a))])
                i32.const(0),
                i32.const(10),
                i32.store(),
                i32.const(0),
                i32.load(),
                E(opcodes.call(consoleLog))
            ]
        })
    }

    const bytecode = awa.compile(module)
    console.log(renderBytecode(bytecode))

    // // --- running wasm module ---

    const wasm = await WebAssembly.instantiate(bytecode, { console: { log: console.log } } as any)
    console.log(wasm)
    const m = wasm.instance.exports as any
    m.foo(9)
    // m.foo(10)
    // m.foo(11)
    // m.foo(12)

    // const wasm = await WebAssembly.instantiateStreaming(fetch('./foo.wasm'), { console: { log: console.log } } as any)
    // console.log(wasm);
    // (wasm.instance.exports as any).lognum(11)
})()
