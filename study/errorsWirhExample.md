## Core

### ERROR_UNEXPECTED_TYPE_FOR_PARAMETER

unexpected type specified for a parameter of an anonymous function

```
language core;

fn f(x : Nat) -> Nat {
  return succ(x)
}

fn g(k : fn(Nat) -> Nat) -> fn(Bool) -> Nat {
  return fn(x : Nat) { // должен быть Bool
    return k(k(x))
  }
}

fn main(n : Nat) -> Nat {
  return
   (if Nat::iszero(n)
      then f
      else g(f))(n)
}

```

### ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION

type of an expression does not match an expected type (known from larger context)

```
language core;

fn main(x : Nat) -> Nat {
    return if false then true else 0
}
```

### ERROR_UNEXPECTED_LAMBDA

unexpected anonymous function where an expression of a non-function type is expected

```
fn f(x : Nat) -> Nat {
  return succ(x)
}

fn g(k : fn(Nat) -> Nat) -> Nat {
  return fn(x : Nat) {
    return k(k(x))
  }
}

fn main(n : Nat) -> Nat {
  return
   (if Nat::iszero(n)
      then f
      else g(f))(n)
}

```

### ERROR_NOT_A_FUNCTION

unexpected expression where a function is expected

```
language core;

fn main(n : Nat) -> Nat {
  return (fn(x : Bool) { return fn(y : Nat) { return succ(y) } })(false)(0)(n)
}

```

### ERROR_UNDEFINED_VARIABLE

undefined variable in a an expression

```
language core;

fn main(x : Nat) -> Nat {
    return if true then y else succ(0)
}

```

### ERROR_MISSING_MAIN

a program is missing main function

## Records

### ERROR_MISSING_RECORD_FIELDS

record is missing one or more of the expected fields

```
language core;

extend with #records;

fn mk(k : fn(Nat) -> Bool) -> { x : fn(Bool) -> Nat, y : Nat, z : Nat } {
  return
    { x = fn(x : Bool) {
            return if k(succ(0))
              then if x then 0 else succ(0)
              else succ(succ(0))
          }
    , y = 0 }
}

fn main(x : Nat) -> Nat {
  return mk(fn(x : Nat) { return Nat::iszero(x)}).x(false)
}
```

### ERROR_UNEXPECTED_RECORD_FIELDS

record has one or more unexpected fields

```
language core;

extend with #records;

fn mk(k : fn(Nat) -> Bool) -> { x : fn(Bool) -> Nat, y : Nat } {
  return
    { x = fn(x : Bool) {
            return if k(succ(0))
              then if x then 0 else succ(0)
              else succ(succ(0))
          }
    , y = 0
    , z = succ(0) }
}

fn main(x : Nat) -> Nat {
  return mk(fn(x : Nat) { return Nat::iszero(x)}).x(false)
}
```

### ERROR_UNEXPECTED_RECORD

unexpected record where an expression of a non-record type is expected

```
language core;

extend with #records;

fn main(x : Nat) -> Nat {
  return
    { f = 0, g = fn(x : Bool) { return if x then succ(0) else 0 }}
}

```

### ERROR_NOT_A_RECORD

unexpected expression where a record is expected

```
extend with #records;

fn mk(k : fn(Nat) -> Bool) -> { x : fn(Bool) -> Nat, y : Nat } {
  return
    { x = { x = fn(x : Bool) {
                  return if k(succ(0))
                    then if x then 0 else succ(0)
                    else succ(succ(0))
                }
          , y = succ(0) }
    , y = { x = fn(x : Bool) {
                  return if k(succ(0))
                    then if x then 0 else succ(0)
                    else succ(succ(0))
                }
          , y = succ(0) } }.x.y.x
}

fn main(x : Nat) -> Nat {
  return mk(fn(x : Nat) { return Nat::iszero(x)}).x(false)
}
```

### ERROR_UNEXPECTED_FIELD_ACCESS

access to a field that is not present in the record

```
language core;

extend with #records;

fn mk(k : fn(Nat) -> Bool) -> { x : fn(Bool) -> Nat, y : Nat } {
  return
    { x = { x = fn(x : Bool) {
                  return if k(succ(0))
                    then if x then 0 else succ(0)
                    else succ(succ(0))
                }
          , y = succ(0) }
    , y = { x = fn(x : Bool) {
                  return if k(succ(0))
                    then if x then 0 else succ(0)
                    else succ(succ(0))
                }
          , y = succ(0) } }.x.z
}

fn main(x : Nat) -> Nat {
  return mk(fn(x : Nat) { return Nat::iszero(x)}).x(false)
}
```

## Tuples

### ERROR_TUPLE_INDEX_OUT_OF_BOUNDS

```
language core;
extend with #tuples;

fn rotate3(p : {Nat, Nat, Nat}) -> {Nat, Nat, Nat} {
  return {p.3, p.4, p.2}
}

fn main(x : Nat) -> {Nat, Nat, Nat} {
  return rotate3({x, succ(x), succ(succ(x))})
}
```

### ERROR_UNEXPECTED_TUPLE

unexpected tuple/pair where an expression of a non-tuple type is expected

### ERROR_NOT_A_TUPLE

unexpected expression where a tuple/pair is expected

```
language core;
extend with #tuples;

fn rotate3(p : {Nat, Nat, Nat}) -> {Nat, Nat, Nat} {
  return {rotate3.3, p.1, p.2}
}

fn main(x : Nat) -> {Nat, Nat, Nat} {
  return rotate3({x, succ(x), succ(succ(x))})
}
```

## Sum

### ERROR_AMBIGUOUS_SUM_TYPE

when it is impossible to typecheck an expression of a sum type because the other half of the type is unknown

```
language core;

extend with #sum-types;

fn main(n : Nat) -> fn(Bool) -> Nat + Bool {
  return (fn (b : Bool) { return inl(n) })(true)
}

```

```
language core;

extend with #sum-types;
extend with #type-ascriptions;
extend with #pairs;

fn main(n : Nat) -> Nat {
  return {inl(0), 0}.2
}

```

### ERROR_UNEXPECTED_INJECTION

when an injection into a sum type (inl or inr) is encountered instead of an expression of expected non-sum type

```
language core;
extend with #sum-types;

fn g(x : Nat + Bool) -> Nat {
  return match x {
      inl(n) => succ(n)
    | inr(bf) => if bf then 0 else inl(bf)
  }
}

fn main(x : Nat) -> Nat {
  return g(inr(false))
}

```

## List

### ERROR_AMBIGUOUS_LIST_TYPE

when it is impossible to typecheck an expression of a list type because the type of its elements is unknown

```
language core;
extend with #lists;


fn main(n : Nat) -> Bool {
  return List::isempty([])
}

```

### ERROR_NOT_A_LIST

when an expression of a non-list type appears as the argument to one of the builtin list functions (List::head, List::tail, or List::isempty)

```
language core;
extend with #lists, #general-recursion;

fn length(list : [Nat]) -> Nat {
  return if List::isempty(succ(0))
    then 0
    else succ(length(List::tail(list)))
}

fn main(n : Nat) -> Nat {
  return length(cons(n, [n, n, n, 0, succ(n), false, n]))
}
```

### ERROR_UNEXPECTED_LIST

when a list (List or ConsList) is encountered instead of an expression of expected non-list type

```
language core;
extend with #lists;

fn main(x : Nat) -> Nat {
    return (if [false] then fn(x : Nat) { return 0 } else fn(x : Nat) { return 0 } )(0)
}

```

## Match

### ERROR_ILLEGAL_EMPTY_MATCHING — when match-expression does not have any patterns

### ERROR_NONEXHAUSTIVE_MATCH_PATTERNS

when match-expression does not have all necessary patterns (inl and inr for sum types and at least the empty list pattern and cons-pattern for lists)

```
language core;
extend with #variants;

fn g(x : <| number : Nat, boolean : Bool, function : fn(Nat) -> Nat |>) -> Nat {
  return match x {
      <| number   = n |> => succ(n)
    | <| function = f |> => f(f(succ(0))) // у нас тут пропущен boolean
  }
}

fn main(x : Nat) -> Nat {
  return g(<| function = fn(n : Nat) { return g(<| number = n |>) } |>)
}
```

### ERROR_UNEXPECTED_PATTERN_FOR_TYPE

when a pattern in a match-expression does not correspond to the type of matched expression

```
language core;
extend with #variants;
extend with #type-ascriptions;

fn g(x : <| number : Nat, boolean : Bool, function : fn(Nat) -> Nat |>) -> Nat {
  return match x {
      <| number   = n |> => succ(n)
    | <| boolean  = b |> => if b then succ(0) else 0
    | <| function = f |> => f(f(succ(0)))
    | <| unknown  = x |> => 0 // импостер
  }
}

fn main(x : Nat) -> Nat {
  return g(<| function = fn(n : Nat) {
      return g(<| unknown = n |>
        as <| number : Nat, boolean : Bool, function : fn(Nat) -> Nat |>) }
  |> as <| number : Nat, boolean : Bool, function : fn(Nat) -> Nat |>)
}
```

## Variants

exemple

```
language core;

extend with #variants, #unit-type, #structural-patterns;

fn attempt(get_one? : Bool) -> <| value : Nat, failure : Unit |> {
  return
    if get_one?
      then <| value = 0 |>
      else <| failure = unit |>
}

fn main(succeed : Bool) -> Nat {
  return match attempt(succeed) {
      <| value = n |> => succ(n)
    | <| failure = unit |> => 0
  }
}
```

### ERROR_AMBIGUOUS_VARIANT_TYPE

when type of a variant (Variant) cannot be inferred (needs a type ascription)

```
language core;

extend with #variants;
extend with #type-ascriptions;
extend with #pairs;

fn main(n : Nat) -> Nat {
  return {<| value = n |>, 0}.2
}
```

### ERROR_UNEXPECTED_VARIANT

when a variant (Variant) is encountered where an expression of a non-variant type is expected

```
language core;

extend with #variants;
extend with #type-ascriptions;

fn main(n : Nat) -> fn(Bool) -> Nat {
  return (fn (b : Bool) { return  <| value = n |>  })(true) // функция должна вернуть Nat, НО возвращается Variant
}
```

### ERROR_UNEXPECTED_VARIANT_LABEL

when a variant (Variant) contains a label that does not match any of the labels in the expected varian type

```
language core;
extend with #variants;
extend with #type-ascriptions;

fn g(x : <| number : Nat, boolean : Bool, function : fn(Nat) -> Nat |>) -> Nat {
  return match x {
      <| number   = n |> => succ(n)
    | <| boolean  = b |> => if b then succ(0) else 0
    | <| function = f |> => f(f(succ(0)))
  }
}

fn main(x : Nat) -> Nat {
  return g(<| function = fn(n : Nat) {
      return g(<| number = n |>
        as <| number1 : Nat, boolean : Bool, function : fn(Nat) -> Nat |>) } // IMPOSTER
  |> as <| number : Nat, boolean : Bool, function : fn(Nat) -> Nat |>)
}
```

more simple

```
language core;
extend with #variants;

fn main(a : Nat) -> <| foo : Nat |> {
    return <| bar = 0 |>
}
```

## Exeptions

```
language core;

extend with #exceptions, #exception-type-declaration;

exception type = Nat

fn fail(n : Nat) -> Bool {
  return throw(succ(0))
}

fn main(n : Nat) -> Bool {
  return try {
    fail(n)
  } catch {
    a => true
  }
}
```

```
language core;

extend with #exceptions, #exception-type-declaration, #variants;

exception type = <| good : Bool |>

fn main(n : Nat) -> Bool {
    return throw(<| good = true |>)
}
```

### ERROR_EXCEPTION_TYPE_NOT_DECLARED

if an exception mechanism (Throw, TryCatch) is used without a globally declared exception type

```
language core;

extend with #exceptions, #exception-type-declaration, #variants;

fn main(n : Nat) -> Bool {
    return throw(<| good = true |>)
}

```

### ERROR_AMBIGUOUS_THROW_TYPE

if the type of throw-expression cannot be inferred (not the type of of the exception, but the type of throw-expression itself!)

```
language core;

extend with #exceptions, #exception-type-declaration;

exception type = Nat

fn main(a : Nat) -> Nat {
  return (throw(0))(throw(0))
}
```

```
language core;

extend with #exceptions, #exception-type-declaration, #lists;

exception type = Nat

fn main(n : Nat) -> Bool {
  return List::isempty(throw(0))
}

```

## Panic

### ERROR_AMBIGUOUS_PANIC_TYPE

if a panic expression is found without an expected type for it

```
language core;

extend with #panic;

fn main(a : Nat) -> Nat {
  return panic!(0)
}
```

## Refer

```
language core;

extend with
  #references,
  #sequencing,
  #let-bindings;

fn main(n : Nat) -> Nat {
  return
    let x = new(0) in
    x := (succ (*x));
    x := *x;
    *x
}
```

### ERROR_AMBIGUOUS_REFERENCE_TYPE

if a bare memory address is found without an expected type for it

```
language core;

extend with #references, #let-bindings;

fn main(n : Nat) -> Nat {
  return let ref = <0xABCDEF> in *ref
}

```

### ERROR_NOT_A_REFERENCE

when to assign to or dereference an expression that does not have a reference type

```
language core;

extend with #records;
extend with #references;

fn rotate3(p : {x : Nat, y : Nat, z : Nat}) -> {a : Nat, b : Nat, c : Nat} {
  return {a = p.z, b = p.y, c = *p.x}
}

fn main(x : Nat) -> {a : Nat, b : Nat, c : Nat} {
  return rotate3({x = x, y = succ(x), z = succ(succ(x))})
}

```

### ERROR_UNEXPECTED_MEMORY_ADDRESS

if a memory address literal is found when not expecting a reference

```
language core;

extend with #references;

fn chck(b : Bool) -> Bool {
  return (if true then false else true)
}

fn main(b : Bool) -> Bool {
  return chck(<0xABCDEF>)
}
```

## Fix

```
language core;
extend with #fixpoint-combinator;

fn swap(p : Nat) -> Nat {
  return fix(p)
}

fn main(x : Nat) -> Nat {
  return swap(x)
}

```
