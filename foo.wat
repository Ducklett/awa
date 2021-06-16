(module
    (func (export "foo") (param $a i32) (result i32) (local $b i32) (local $d i64) (local $c i32) 
        i32.const 4
        local.set $b
        local.get $b
    )
)
