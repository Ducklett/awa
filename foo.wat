(module
    (func (export "max") (param $a i32) (param $b i32) (result i32) 
        (if (result i32)
            (i32.gt_s (local.get $a) (local.get $b))
            (then (local.get $a))
            (else (local.get $b))
        )
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
