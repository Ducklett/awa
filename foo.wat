(module
    (memory $mem (export "mem") 1 8)
    (func (export "foo")
        i32.const 1
        i32.const 4 
        i32.store
        i32.const 0
        i32.const 8
        i32.store
        ;; (i32.load (i32.const 1))
    )
)
