(module
    ;; (func $add (param $a i32) (param $b i32) (result i32)
    ;;     local.get $a
    ;;     local.get $b
    ;;     i32.add
    ;; )

    (func $foo (export "wadd") (param i32 i32) (result i32) 
        local.get 0
        local.get 1
        i32.add
    )

    ;; (func $bar (export "quuy") (result i32) i32.const  4)
    ;; (func $baz (export "quuz") (result i32) i32.const  6)
    ;; (func $baa (export "quua") (result i32) i32.const  8)

    ;; (func $foo (param $x i32) (result i32)
    ;;     local.get $x
    ;;     call $double
    ;;     local.get $x
    ;;     call $add
    ;; )
    ;; (export "add" (func $add))
    ;; (export "foo" (func $foo))
)
