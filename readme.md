# Awa

Learning webassembly by *"reverse engineering"* the bytecode format and writing my own assembler in javascript.

# Method

I generate `.wasm` modules from `.wat` files and find out which bytes do what by making incremental changes.

Once I've got a basic understanding about what's going on I implement the feature in awa and see what breaks when I tweak the input parameters. I can then compare the output of awa to that of `wat2wasm` and figure out what I'm missing.

After getting a basic understanding of the binary format through this process I used the binary specification for some of the boring parts like filling in opcode tables.

See `notes.txt`.

# Why

All the learning material I can find on webassembly is either incredibly high level or incredibly dry. Learning this way is a lot more fun :)

# Resources

- [MDN - Understanding WebAssembly text format](https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format)
- [Github - WABT: The WebAssembly Binary Toolkit](https://github.com/WebAssembly/wabt)
- [Github - WebAssembly Semantics](https://github.com/WebAssembly/design/blob/main/Semantics.md)
- [WebAssembly Specification - Binary Format](https://webassembly.github.io/spec/core/binary/index.html)
