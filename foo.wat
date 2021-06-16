(module
    (import "console" "log" (func $log (param i32)))

    (func (export "foo") (param $a i32)
        (call $log (local.get $a))

    ;;     (if (i32.gt_s (local.get $a) (i32.const 10))
    ;;    (then
    ;;     local.get $a
    ;;     call $log
    ;;    ) 
    ;;     )
    
    )
)
