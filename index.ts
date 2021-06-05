import awa, { paramIndex, renderBytecode } from './awa'

const { type } = awa;
const { local, call, i32 } = awa.opcodes;

(async () => {
    // --- creating wasm module ---

    const module = awa.create()

    const [a, b] = paramIndex
    const add = awa.funcId(module)

    awa.func(module, {
        name: 'foo',
        params: [type.i32, type.i32],
        result: [type.i32],
        opcodes: [local.get(a), local.get(b), call(add), i32.const(2), i32.add()]
    })

    awa.func(module, {
        id: add,
        params: [type.i32, type.i32],
        result: [type.i32],
        opcodes: [local.get(a), local.get(b), i32.add()]
    })

    const bytecode = awa.compile(module)
    console.log(renderBytecode(bytecode))

    // // --- running wasm module ---

    const wasm = await WebAssembly.instantiate(bytecode)
    console.log(wasm)
    console.log((wasm.instance.exports as any).foo(34, 35))
    // console.log(wasm.instance.exports.wsub(0, 0))
})()
