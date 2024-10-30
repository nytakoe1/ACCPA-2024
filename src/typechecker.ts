import type {
  Abstraction,
  Application,
  Assignment,
  Cons,
  ConstBool,
  ConstInt,
  ConstMemory,
  ConstUnit,
  DeclFun,
  Dereference,
  DotRecord,
  DotTuple,
  Expr,
  Fix,
  If,
  Inl,
  Inr,
  Let,
  List,
  ListHead,
  ListIsEmpty,
  ListTail,
  Match,
  NatIsZero,
  NatRec,
  Panic,
  PatternInl,
  PatternInr,
  PatternVar,
  PatternVariant,
  Program,
  Record,
  Reference,
  Sequence,
  Succ,
  Throw,
  TryCatch,
  TryWith,
  Tuple,
  Type,
  TypeBool,
  TypeFun,
  TypeList,
  TypeNat,
  TypeRecord,
  TypeRef,
  TypeSum,
  TypeTop,
  TypeTuple,
  TypeUnit,
  TypeUnresolved,
  TypeVariant,
  Var,
  Variant,
  VariantFieldType,
} from "./ast";

var equal = require("deep-equal");

const TYPE_NAT: TypeNat = { type: "TypeNat" };
const TYPE_BOOL: TypeBool = { type: "TypeBool" };
const TYPE_UNIT: TypeUnit = { type: "TypeUnit" };
const TYPE_UNRESOLVED: TypeUnresolved = { type: "TypeUnresolved" };
const exceptionTypes: Type[] = [];

class Context {
  table: Map<string, Type>;
  hasMain: boolean;

  constructor() {
    this.table = new Map();
    this.hasMain = false;
  }
}

export function typecheckProgram(ast: Program) {
  const ctx = new Context();
  for (const decl of ast.declarations) {
    switch (decl.type) {
      case "DeclExceptionType": {
        exceptionTypes.push(decl.exceptionType);
        break;
      }
      case "DeclFun": {
        typecheckFunctionDecl(decl, ctx);
        ctx.table.set(decl.name, {
          type: "TypeFun",
          parametersTypes: [decl.parameters[0].paramType],
          returnType: decl.returnType!,
        });
        if (decl.name === "main") {
          ctx.hasMain = true;
        }
        break;
      }
      default:
        throw new Error("Unknown declaration type");
    }
  }
  if (!ctx.hasMain) {
    throw new Error(Errors.MISSING_MAIN);
  }
  console.log("Everything typechecks!");
}

function typecheckFunctionDecl(decl: DeclFun, ctx: Context) {
  console.log(`Checking the function "${decl.name}"...`);
  const name = decl.name;
  const param = decl.parameters[0];
  const returnValue = decl.returnValue;
  const returnType = decl.returnType;
  const tableCopy = new Map(ctx.table);
  tableCopy.set(param.name, param.paramType);
  tableCopy.set(decl.name, {
    type: "TypeFun",
    parametersTypes: [param.paramType],
    returnType: returnType!,
  } as TypeFun);
  const ctxCopy: Context = {
    ...ctx,
    table: tableCopy,
  };
  const bodyType = typecheckExpr(returnValue, returnType!, ctxCopy);
  verifyRecordFields(returnType!, bodyType);
  if (!checkTypeCompatibility(bodyType, returnType!)) {
    throw Error(triggerUnexpectedExpression(returnType!, bodyType));
  }
}

function checkTypeCompatibility(actual: Type, expected: Type): boolean {
  if (expected && expected.type == "TypeUnresolved") return true;
  switch (actual.type) {
    case "TypeUnresolved": {
      return true;
    }
    case "TypeNat": {
      return equal(expected, actual);
    }
    case "TypeBool": {
      return equal(expected, actual);
    }
    case "TypeUnit": {
      return equal(expected, actual);
    }
    case "TypeFun": {
      if (expected.type !== "TypeFun") return false;

      if (checkTypeCompatibility(actual.returnType, expected.returnType)) {
        if (
          !checkTypeCompatibility(
            actual.parametersTypes[0],
            expected.parametersTypes[0]
          )
        ) {
          throw Error(Errors.UNEXPECTED_TYPE_FOR_PARAMETER);
        }
        return true;
      }
      return false;
    }
    case "TypeRecord": {
      if (expected.type != "TypeRecord") return false;
      if (actual.fieldTypes.length < expected.fieldTypes.length) return false;

      for (let i = 0; i < expected.fieldTypes.length; i++) {
        const expectedField = expected.fieldTypes[i];
        const actualField = actual.fieldTypes[i];
        if (!checkTypeCompatibility(actualField, expectedField)) {
          return false;
        }
      }
      return true;
    }
    case "RecordFieldType": {
      if (expected.type !== "RecordFieldType") return false;

      return checkTypeCompatibility(actual.fieldType, expected.fieldType);
    }
    case "TypeTuple": {
      if (expected.type != "TypeTuple") return false;
      if (actual.types.length < expected.types.length) return false;

      for (let i = 0; i < expected.types.length; i++) {
        const expectedField = expected.types[i];
        const actualField = actual.types[i];

        if (!checkTypeCompatibility(actualField, expectedField)) return false;
      }
      return true;
    }
    case "TypeSum": {
      if (expected.type !== "TypeSum") return false;
      if (
        (actual.left &&
          expected.left &&
          !checkTypeCompatibility(actual.left, expected.left)) ||
        (actual.right &&
          expected.right &&
          !checkTypeCompatibility(actual.right, expected.right))
      ) {
        return false;
      }
      return true;
    }
    case "TypeList": {
      if (expected.type != "TypeList") return false;

      return checkTypeCompatibility(actual.elementType, expected.elementType);
    }
    case "TypeVariant": {
      if (expected.type !== "TypeVariant") return false;

      for (let i = 0; i < expected.fieldTypes.length; i++) {
        const expectedField = expected.fieldTypes[i];
        const actualField = actual.fieldTypes.find(
          (e) => e.label == expectedField.label
        );
        if (!actualField) continue;
        if (!checkTypeCompatibility(actualField, expectedField)) return false;
      }

      return true;
    }
    case "VariantFieldType": {
      if (expected.type !== "VariantFieldType") return false;
      return checkTypeCompatibility(actual.fieldType!, expected.fieldType!);
    }
    case "TypeRef": {
      if (expected.type !== "TypeRef") return false;

      return checkTypeCompatibility(actual.referredType, expected.referredType);
    }
    default:
      throw Error("Sorry ..... ");
  }
}

function triggerUnexpectedExpression(expected: Type, actual: Type): string {
  if (expected.type !== "TypeUnresolved") {
    console.log(`expected "${expected.type}"...`);
    console.log(`actual "${actual.type}"...`);
    if (
      expected.type === "TypeFun" &&
      actual.type !== "TypeFun" &&
      expected.parametersTypes[0].type === TYPE_UNRESOLVED.type
    ) {
      return Errors.NOT_A_FUNCTION;
    }
    return Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION;
  }
  return Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION;
}

function typecheckExpr(expr: Expr, expected: Type, ctx: Context): Type {
  switch (expr.type) {
    case "Var": {
      return processVar(expr, expected, ctx);
    }
    case "Succ": {
      return processSucc(expr, expected, ctx);
    }
    case "ConstBool": {
      return processConstBool(expr, expected, ctx);
    }
    case "ConstInt": {
      return processConstInt(expr, expected, ctx);
    }
    case "If": {
      return processIf(expr, expected, ctx);
    }
    case "NatIsZero": {
      return processNatIsZero(expr, expected, ctx);
    }
    case "NatRec": {
      return processNatRec(expr, expected, ctx);
    }
    case "Abstraction": {
      return processAbstraction(expr, expected, ctx);
    }
    case "Application":
      return processApplication(expr, expected, ctx);
    case "Let":
      return processLet(expr, expected, ctx);
    case "Record":
      return processRecord(expr, expected, ctx);
    case "DotRecord":
      return processDotRecord(expr, expected, ctx);
    case "Tuple":
      return processTuple(expr, expected, ctx);
    case "DotTuple":
      return processDotTuple(expr, expected, ctx);
    case "Unit":
      return processUnit(expr, expected, ctx);
    case "Inl":
      return processInl(expr, expected, ctx);
    case "Inr":
      return processInr(expr, expected, ctx);
    case "TypeAscription": {
      typecheckExpr(expr.expr, expr.ascribedType, ctx);
      return expr.ascribedType;
    }
    case "Match":
      return processMatch(expr, expected, ctx);
    case "ListIsEmpty":
      return processEmptyList(expr, expected, ctx);
    case "List":
      return processList(expr, expected, ctx);
    case "ListTail":
      return processListTail(expr, expected, ctx);
    case "Cons":
      return processCons(expr, expected, ctx);
    case "ListHead":
      return processListHead(expr, expected, ctx);
    case "Variant":
      return processVariant(expr, expected, ctx);
    case "Fix":
      return processFix(expr, expected, ctx);
    case "ConstMemory":
      return processConstMemory(expr, expected, ctx);
    case "Reference":
      return processReference(expr, expected, ctx);
    case "Dereference":
      return processDereference(expr, expected, ctx);
    case "Assignment":
      return processAssignment(expr, expected, ctx);
    case "Sequence":
      return processSequence(expr, expected, ctx);
    case "Panic":
      return processPanic(expr, expected, ctx);
    case "Throw":
      return processThrow(expr, expected, ctx);
    case "TryCatch":
      return processTryCatch(expr, expected, ctx);
    case "TryWith":
      return processTryWith(expr, expected, ctx);

    default:
      throw new Error("Unknown expression type " + expr.type);
  }
}

function processVar(expr: Var, expected: Type, ctx: Context): Type {
  if (!ctx.table.has(expr.name)) {
    throw new Error(Errors.UNDEFINED_VARIABLE);
  }
  let current = ctx.table.get(expr.name)!;

  if (!checkTypeCompatibility(current, expected)) {
    throw Error(triggerUnexpectedExpression(expected, current));
  }

  return current;
}

function processSucc(expr: Succ, expected: Type, ctx: Context): Type {
  if (expected.type !== "TypeUnresolved") {
    if (!checkTypeCompatibility(expected, TYPE_NAT)) {
      throw Error(triggerUnexpectedExpression(expected, TYPE_NAT));
    }
  }
  const exprType = typecheckExpr(expr.expr, expected, ctx);
  if (!checkTypeCompatibility(exprType, TYPE_NAT)) {
    // проверяем тип возвр. выражения, если не TYPE_NAT - выкинем ошибку
    throw Error(triggerUnexpectedExpression(TYPE_NAT, exprType));
  }
  return TYPE_NAT;
}

function processConstBool(expr: ConstBool, expected: Type, ctx: Context): Type {
  if (!checkTypeCompatibility(TYPE_BOOL, expected)) {
    console.log(`i got it!`);
    if (expected.type == "TypeFun") {
      // тут лябда, иначе мы уйдем в др ошиб
      throw Error(Errors.UNEXPECTED_LAMBDA);
    }
    throw Error(triggerUnexpectedExpression(expected, TYPE_BOOL));
  }
  return TYPE_BOOL;
}

function processConstInt(expr: ConstInt, expected: Type, ctx: Context): Type {
  if (!checkTypeCompatibility(TYPE_NAT, expected)) {
    throw Error(triggerUnexpectedExpression(expected, TYPE_NAT));
  }
  return TYPE_NAT;
}

function processIf(expr: If, expected: Type, ctx: Context): Type {
  const ifType = typecheckExpr(expr.condition, TYPE_BOOL, ctx);
  const thenType = typecheckExpr(expr.thenExpr, TYPE_UNRESOLVED, ctx);
  const elseType = typecheckExpr(expr.elseExpr, thenType, ctx);

  if (!checkTypeCompatibility(elseType, thenType)) {
    throw Error(triggerUnexpectedExpression(expected, thenType));
  }
  return thenType;
}

function processNatIsZero(expr: NatIsZero, expected: Type, ctx: Context): Type {
  // проверяем NatIsZero (важно, оно принимает NAT, возвр. Bool)
  if (!checkTypeCompatibility(expected, TYPE_BOOL)) {
    throw Error(triggerUnexpectedExpression(expected, TYPE_BOOL));
    //throw Error(Errors.UNEXPECTED_TYPE_FOR_PARAMETER);
  }
  typecheckExpr(expr.expr, TYPE_NAT, ctx);
  return TYPE_BOOL;
}

function processNatRec(expr: NatRec, expected: Type, ctx: Context): Type {
  // const inputVal = expr.n;
  // n - Nat, z - any type T , s - fun (return type of z)
  typecheckExpr(expr.n, TYPE_NAT, ctx);

  const defaultVal = typecheckExpr(expr.initial, expected, ctx);

  if (!checkTypeCompatibility(defaultVal, expected)) {
    throw Error(triggerUnexpectedExpression(defaultVal, expected));
    // throw Error(Errors.UNEXPECTED_TYPE_FOR_PARAMETER);
  }

  const stepExpectedFun: TypeFun = {
    type: "TypeFun",
    parametersTypes: [TYPE_NAT],
    returnType: {
      type: "TypeFun",
      parametersTypes: [defaultVal],
      returnType: defaultVal,
    },
  };

  typecheckExpr(expr.step, stepExpectedFun, ctx);
  return defaultVal;
}

function processAbstraction(
  expr: Abstraction,
  expected: Type,
  ctx: Context
): Type {
  const param = expr.parameters[0];
  const tableCopy = new Map(ctx.table);
  tableCopy.set(param.name, param.paramType);
  const ctxCopy: Context = {
    ...ctx,
    table: tableCopy,
  };

  if (expected.type !== "TypeUnresolved" && expected.type != "TypeFun") {
    throw Error(Errors.UNEXPECTED_LAMBDA);
  }
  if (
    expected.type !== "TypeUnresolved" &&
    expected.parametersTypes[0].type !== "TypeUnresolved" &&
    expected.parametersTypes[0].type != param.paramType.type
  ) {
    throw Error(Errors.UNEXPECTED_TYPE_FOR_PARAMETER);
  }
  const bodyType = typecheckExpr(expr.returnValue, TYPE_UNRESOLVED, ctxCopy);

  if (expr.returnValue.type !== "TypeAscription") {
    if (bodyType.type == "TypeSum" && param.paramType.type != "TypeSum") {
      throw Error(Errors.ERROR_AMBIGUOUS_SUM_TYPE);
    }
  }

  typecheckExpr(
    expr.returnValue,
    expected.type != "TypeUnresolved" ? expected.returnType : TYPE_UNRESOLVED,
    ctxCopy
  );

  return {
    type: "TypeFun",
    parametersTypes: [param.paramType],
    returnType: bodyType,
  };
}

function processApplication(
  expr: Application,
  expected: Type,
  ctx: Context
): Type {
  const { function: func, arguments: args } = expr;
  const functionType = typecheckExpr(
    func,
    {
      type: "TypeFun",
      parametersTypes: [TYPE_UNRESOLVED],
      returnType: expected,
    } as TypeFun,
    ctx
  ) as TypeFun;
  if (functionType.type !== "TypeFun") {
    throw new Error(Errors.NOT_A_FUNCTION);
  }

  let expectedArgumentType = (functionType.parametersTypes as Type[])[0];

  let actualArgumentType = typecheckExpr(args[0], expectedArgumentType, ctx);

  // выкинуть нужно ошибку о не совместимости

  if (expectedArgumentType.type !== actualArgumentType.type) {
    throw Error(
      triggerUnexpectedExpression(expectedArgumentType, actualArgumentType)
    );
  }
  if (
    expected.type !== "TypeUnresolved" &&
    actualArgumentType.type == "TypeVariant" &&
    functionType.parametersTypes[0]?.type == "TypeVariant"
  ) {
    for (const field of actualArgumentType.fieldTypes) {
      let paramFieldTypes = functionType.parametersTypes[0].fieldTypes;
      let typeForLabel = paramFieldTypes.find((t) => t.label == field.label);

      let actualField = actualArgumentType.fieldTypes.find(
        (t) => t.label == field.label
      );

      if (
        actualField &&
        typeForLabel &&
        !checkTypeCompatibility(actualField, typeForLabel)
      ) {
        throw Error(
          triggerUnexpectedExpression(
            functionType.parametersTypes[0],
            actualArgumentType
          )
        );
      }
    }
  }
  return functionType.returnType;
}

function processLet(expr: Let, expected: Type, ctx: Context): Type {
  const patternBindings = expr.patternBindings[0];
  if (patternBindings.pattern.type !== "PatternVar") {
    throw Error("Only variables");
  }
  const resolvedType = typecheckExpr(patternBindings.rhs, TYPE_UNRESOLVED, ctx);
  const contextWithBinding = {
    ...ctx,
    table: new Map(ctx.table).set(patternBindings.pattern.name, resolvedType),
  };
  return typecheckExpr(expr.body, expected, contextWithBinding);
}

function processRecord(expr: Record, expected: Type, ctx: Context): Type {
  if (expected.type !== "TypeUnresolved" && expected.type != "TypeRecord") {
    throw Error(Errors.ERROR_UNEXPECTED_RECORD);
  }
  const fieldTypes = expr.bindings.map((binding) => {
    const fieldSpec =
      expected.type !== "TypeUnresolved"
        ? expected.fieldTypes.find(
            (fieldDef) => fieldDef.label === binding.name
          )
        : TYPE_UNRESOLVED;

    const checkedFieldType = typecheckExpr(
      binding.expr,
      fieldSpec && fieldSpec.type !== "TypeUnresolved"
        ? fieldSpec.fieldType
        : TYPE_UNRESOLVED,
      ctx
    );

    return {
      type: "RecordFieldType",
      label: binding.name,
      fieldType: checkedFieldType,
    };
  });
  let actualRec = {
    type: "TypeRecord",
    fieldTypes: fieldTypes,
  } as TypeRecord;

  verifyRecordFields(expected, actualRec);

  return actualRec;
}

function processDotRecord(expr: DotRecord, expected: Type, ctx: Context): Type {
  let type = typecheckExpr(expr.expr, TYPE_UNRESOLVED, ctx);
  if (type.type != "TypeRecord") {
    throw Error(Errors.ERROR_NOT_A_RECORD);
  }
  for (const fieldType of type.fieldTypes) {
    if (fieldType.label == expr.label) {
      return fieldType.fieldType;
    }
  }
  throw Error(Errors.ERROR_UNEXPECTED_FIELD_ACCESS);
}

function processTuple(expr: Tuple, expected: Type, ctx: Context): Type {
  if (expected.type !== "TypeUnresolved" && expected.type != "TypeTuple") {
    throw Error(Errors.ERROR_UNEXPECTED_TUPLE);
  }

  const componentTypes = expr.exprs.map((element, index) => {
    const expectedElementType =
      expected.type !== "TypeUnresolved"
        ? expected.types[index]
        : TYPE_UNRESOLVED;
    const elementType = typecheckExpr(element, expectedElementType, ctx);
    if (element.type !== "TypeAscription") {
      if (elementType.type === "TypeSum") {
        throw Error(Errors.ERROR_AMBIGUOUS_SUM_TYPE);
      }
      if (elementType.type === "TypeVariant") {
        throw Error(Errors.ERROR_AMBIGUOUS_VARIANT_TYPE);
      }
    }
    return elementType;
  });

  return { type: "TypeTuple", types: componentTypes } as TypeTuple;
}

function processDotTuple(expr: DotTuple, expected: Type, ctx: Context): Type {
  let type = typecheckExpr(expr.expr, TYPE_UNRESOLVED, ctx);
  if (type.type != "TypeTuple") {
    throw Error(Errors.ERROR_NOT_A_TUPLE);
  }
  if (expr.index > type.types.length) {
    throw Error(Errors.ERROR_TUPLE_INDEX_OUT_OF_BOUNDS);
  }
  return type.types[expr.index - 1];
}

function processUnit(expr: ConstUnit, expected: Type, ctx: Context): Type {
  if (expected.type != "TypeUnresolved") {
    if (!checkTypeCompatibility(TYPE_UNIT, expected)) {
      throw Error(triggerUnexpectedExpression(expected, TYPE_UNIT));
    }
  }

  return TYPE_UNIT;
}

function processInl(expr: Inl, expected: Type, ctx: Context): Type {
  if (expected.type != "TypeUnresolved" && expected.type != "TypeSum") {
    throw Error(Errors.ERROR_UNEXPECTED_INJECTION);
  }
  const leftSumType = {
    type: "TypeSum",
    left: typecheckExpr(
      expr.expr,
      expected.type !== "TypeUnresolved" ? expected.left : TYPE_UNRESOLVED,
      ctx
    ),
  } as TypeSum;

  if (
    expected.type !== "TypeUnresolved" &&
    expected.left &&
    leftSumType.left &&
    expected.left.type !== leftSumType.left.type
  ) {
    throw Error(triggerUnexpectedExpression(expected, leftSumType));
  }
  return leftSumType;
}

function processInr(expr: Inr, expected: Type, ctx: Context): Type {
  if (expected.type != "TypeUnresolved" && expected.type != "TypeSum") {
    throw Error(Errors.ERROR_UNEXPECTED_INJECTION);
  }
  const rightSumType = {
    type: "TypeSum",
    right: typecheckExpr(
      expr.expr,
      expected.type !== "TypeUnresolved" ? expected.right : TYPE_UNRESOLVED,
      ctx
    ),
  } as TypeSum;

  if (
    expected.type !== "TypeUnresolved" &&
    expected.right &&
    rightSumType.right &&
    expected.right.type !== rightSumType.right.type
  ) {
    throw Error(triggerUnexpectedExpression(expected, rightSumType));
  }
  return rightSumType;
}

function processMatch(expr: Match, expected: Type, ctx: Context): Type {
  const { cases: matchCases, expr: matchExpr } = expr;

  if (expr.expr.type !== "TypeAscription" && expr.expr.type === "Variant") {
    throw Error(Errors.ERROR_AMBIGUOUS_VARIANT_TYPE);
  }

  const detectedMatchType = typecheckExpr(matchExpr, TYPE_UNRESOLVED, ctx);

  if (detectedMatchType.type === "TypeSum") {
    if (!(detectedMatchType.left && detectedMatchType.right)) {
      throw Error(Errors.ERROR_AMBIGUOUS_SUM_TYPE);
    }

    const requiredPatterns = ["PatternInl", "PatternInr"];
    if (!matchCases.length) throw Error(Errors.ERROR_ILLEGAL_EMPTY_MATCHING);
    if (matchCases.length < requiredPatterns.length)
      throw Error(Errors.ERROR_NONEXHAUSTIVE_MATCH_PATTERNS);
    if (
      !matchCases.every((caseItem) =>
        requiredPatterns.includes(caseItem.pattern.type)
      )
    ) {
      throw Error(Errors.ERROR_UNEXPECTED_PATTERN_FOR_TYPE);
    }

    const uniquePatterns = new Set(matchCases.map((item) => item.pattern.type));
    if (uniquePatterns.size !== requiredPatterns.length)
      throw Error(Errors.ERROR_NONEXHAUSTIVE_MATCH_PATTERNS);

    const inlCase = matchCases.find(
      (item) => item.pattern.type === "PatternInl"
    )!;
    const inrCase = matchCases.find(
      (item) => item.pattern.type === "PatternInr"
    )!;

    const leftSymbolsCopy = new Map(ctx.table);
    leftSymbolsCopy.set(
      ((inlCase.pattern as PatternInl).pattern as PatternVar).name,
      detectedMatchType.left
    );
    const leftCtx: Context = { ...ctx, table: leftSymbolsCopy };

    const rightSymbolsCopy = new Map(ctx.table);
    rightSymbolsCopy.set(
      ((inrCase.pattern as PatternInr).pattern as PatternVar).name,
      detectedMatchType.right
    );
    const rightCtx: Context = { ...ctx, table: rightSymbolsCopy };

    const leftType = typecheckExpr(inlCase.expr, expected, leftCtx);
    const rightType = typecheckExpr(inrCase.expr, expected, rightCtx);

    if (leftType.type !== rightType.type)
      throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
    return leftType;
  } else if (detectedMatchType.type === "TypeBool") {
    const booleanPatterns = ["PatternTrue", "PatternFalse"];
    if (!matchCases.length) throw Error(Errors.ERROR_ILLEGAL_EMPTY_MATCHING);
    if (matchCases.length < booleanPatterns.length)
      throw Error(Errors.ERROR_NONEXHAUSTIVE_MATCH_PATTERNS);
    if (
      !matchCases.every((caseItem) =>
        booleanPatterns.includes(caseItem.pattern.type)
      )
    ) {
      throw Error(Errors.ERROR_UNEXPECTED_PATTERN_FOR_TYPE);
    }

    const trueCase = matchCases.find(
      (item) => item.pattern.type === "PatternTrue"
    )!;
    const falseCase = matchCases.find(
      (item) => item.pattern.type === "PatternFalse"
    )!;
    const trueType = typecheckExpr(trueCase.expr, expected, ctx);
    const falseType = typecheckExpr(falseCase.expr, expected, ctx);

    if (trueType.type !== falseType.type)
      throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
    return trueType;
  } else if (detectedMatchType.type === "TypeVariant") {
    const expectedVariants = new Set(
      detectedMatchType.fieldTypes.map((field) => field.label)
    );
    const actualVariants = new Set(
      matchCases.map((item) => (item.pattern as PatternVariant).label)
    );

    if (!matchCases.length) throw Error(Errors.ERROR_ILLEGAL_EMPTY_MATCHING);

    if (![...actualVariants].every((label) => expectedVariants.has(label))) {
      throw Error(Errors.ERROR_UNEXPECTED_PATTERN_FOR_TYPE);
    }
    if (matchCases.length < expectedVariants.size)
      throw Error(Errors.ERROR_NONEXHAUSTIVE_MATCH_PATTERNS);

    let lastCheckedType: Type = TYPE_BOOL;

    matchCases.forEach((matchCase) => {
      const variantPattern = matchCase.pattern as PatternVariant;
      const patternVar = variantPattern.pattern as PatternVar;
      const fieldType = detectedMatchType.fieldTypes.find(
        (field) => field.label === variantPattern.label
      )?.fieldType;

      const updatedContext = {
        ...ctx,
        table: new Map(ctx.table).set(patternVar.name, fieldType!),
      };

      lastCheckedType = typecheckExpr(matchCase.expr, expected, updatedContext);
    });

    return lastCheckedType;
  } else {
    const firstPattern = matchCases[0].pattern;
    if (["PatternInl", "PatternInr"].includes(firstPattern.type)) {
      throw Error(Errors.ERROR_UNEXPECTED_PATTERN_FOR_TYPE);
    }
    return TYPE_BOOL;
  }
}

function processEmptyList(
  expr: ListIsEmpty,
  expected: Type,
  ctx: Context
): Type {
  if (expected.type != "TypeUnresolved" && expected.type != TYPE_BOOL.type) {
    throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }
  // у нас не может быть НЕ листа
  let bodyType = typecheckExpr(expr.expr, TYPE_UNRESOLVED, ctx);
  if (bodyType.type != "TypeList") {
    throw Error(Errors.ERROR_NOT_A_LIST);
  }

  return TYPE_BOOL;
}

function processList(expr: List, expected: Type, ctx: Context): Type {
  if (expected.type != "TypeUnresolved" && expected.type !== "TypeList") {
    throw Error(Errors.ERROR_UNEXPECTED_LIST);
  }

  if (expr.exprs.length == 0) {
    if (expected.type != "TypeUnresolved") {
      if (!expected.elementType) {
        throw Error(Errors.ERROR_AMBIGUOUS_LIST_TYPE);
      } else
        return {
          type: "TypeList",
          elementType: expected.elementType,
        } as TypeList;
    } else {
      throw Error(Errors.ERROR_AMBIGUOUS_LIST_TYPE);
    }
  }

  let listType = typecheckExpr(expr.exprs[0], TYPE_UNRESOLVED, ctx);

  for (let i = 1; i < expr.exprs.length; i++) {
    const currentType = typecheckExpr(expr.exprs[i], listType, ctx);
    if (!checkTypeCompatibility(currentType, listType)) {
      throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
    }
  }

  typecheckExpr(expr.exprs[0], listType, ctx);

  return {
    type: "TypeList",
    elementType: listType,
  } as TypeList;
}

function processListTail(expr: ListTail, expected: Type, ctx: Context): Type {
  if (expected.type != "TypeUnresolved" && expected.type != "TypeList") {
    throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }
  let bodyType = typecheckExpr(expr.expr, TYPE_UNRESOLVED, ctx);
  if (bodyType.type != "TypeList") {
    throw Error(Errors.ERROR_NOT_A_LIST);
  }
  return {
    type: "TypeList",
    elementType: bodyType.elementType,
  } as TypeList;
}

function processCons(expr: Cons, expected: Type, ctx: Context): Type {
  let tailType = typecheckExpr(
    expr.tail,
    { type: "TypeList" } as TypeList,
    ctx
  );
  let headType = typecheckExpr(expr.head, TYPE_UNRESOLVED, ctx);

  if (tailType.type != "TypeList") {
    throw Error(Errors.ERROR_NOT_A_LIST);
  }

  if (!checkTypeCompatibility(tailType.elementType, headType)) {
    throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }

  return {
    type: "TypeList",
    elementType: headType,
  } as TypeList;
}

function processListHead(expr: ListHead, expected: Type, ctx: Context): Type {
  let actualBodyType = typecheckExpr(
    expr.expr,
    { type: "TypeList", elementType: TYPE_UNRESOLVED } as TypeList,
    ctx
  );

  if (actualBodyType.type != "TypeList") {
    throw Error(Errors.ERROR_NOT_A_LIST);
  }

  return actualBodyType.elementType;
}

function processVariant(expr: Variant, expected: Type, ctx: Context): Type {
  const { label, expr: varExpr } = expr;

  if (expected.type !== "TypeUnresolved" && expected.type !== "TypeVariant") {
    throw Error(Errors.ERROR_UNEXPECTED_VARIANT);
  }

  const isLabelValid =
    expected.type !== "TypeUnresolved" && expected.fieldTypes
      ? expected.fieldTypes.some((field) => field.label === label)
      : true;

  if (!isLabelValid) {
    throw Error(Errors.ERROR_UNEXPECTED_VARIANT_LABEL);
  }

  const labelType =
    expected.type !== "TypeUnresolved"
      ? expected.fieldTypes.find((field) => field.label === label)?.fieldType ||
        TYPE_UNRESOLVED
      : TYPE_UNRESOLVED;

  return {
    type: "TypeVariant",
    fieldTypes: [
      {
        type: "VariantFieldType",
        label,
        fieldType: typecheckExpr(varExpr!, labelType, ctx),
      } as VariantFieldType,
    ],
  } as TypeVariant;
}

function processFix(expr: Fix, expected: Type, ctx: Context): Type {
  const funcType = typecheckExpr(expr.expr, TYPE_UNRESOLVED, ctx);

  if (funcType.type !== "TypeFun" || funcType.parametersTypes.length !== 1) {
    throw Error(Errors.NOT_A_FUNCTION);
  }

  const [paramType] = funcType.parametersTypes;
  if (!checkTypeCompatibility(funcType.returnType, paramType)) {
    throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }

  return funcType.returnType;
}

function processConstMemory(
  expr: ConstMemory,
  expected: Type,
  ctx: Context
): Type {
  if (expected.type == "TypeUnresolved") {
    throw new Error(Errors.ERROR_AMBIGUOUS_REFERENCE_TYPE);
  }

  if (expected.type !== "TypeRef") {
    throw new Error(Errors.ERROR_UNEXPECTED_MEMORY_ADDRESS);
  }

  return expected!;
}

function processReference(expr: Reference, expected: Type, ctx: Context): Type {
  if (expected.type !== "TypeUnresolved" && expected.type !== "TypeRef") {
    throw new Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }

  return {
    type: "TypeRef",
    referredType: typecheckExpr(
      expr.expr,
      expected.type != "TypeUnresolved"
        ? expected.referredType
        : TYPE_UNRESOLVED,
      ctx
    ),
  } as TypeRef;
}

function processDereference(
  expr: Dereference,
  expected: Type,
  ctx: Context
): Type {
  let actualType = typecheckExpr(
    expr.expr,
    {
      type: "TypeRef",
      referredType: expected,
    } as TypeRef,
    ctx
  );
  if (actualType.type !== "TypeRef") {
    throw new Error(Errors.ERROR_NOT_A_REFERENCE);
  }
  return actualType.referredType;
}

function processAssignment(
  expr: Assignment,
  expected: Type,
  ctx: Context
): Type {
  let actualLeftType = typecheckExpr(expr.lhs, TYPE_UNRESOLVED, ctx);
  if (actualLeftType.type !== "TypeRef") {
    throw new Error(Errors.ERROR_NOT_A_REFERENCE);
  }
  let actualRightType = typecheckExpr(
    expr.rhs,
    actualLeftType.referredType,
    ctx
  );
  if (!checkTypeCompatibility(actualLeftType.referredType, actualRightType)) {
    throw new Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }
  return TYPE_UNIT;
}

function processSequence(expr: Sequence, expected: Type, ctx: Context): Type {
  let firstExprActual = typecheckExpr(expr.expr1, TYPE_UNRESOLVED, ctx);
  if (!checkTypeCompatibility(firstExprActual, TYPE_UNIT)) {
    throw Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }
  let secondExprActual = typecheckExpr(expr.expr2, expected, ctx);
  return secondExprActual;
}

function processPanic(expr: Panic, expected: Type, ctx: Context): Type {
  console.log("PAAAANNNNICCCCC");
  if (expected.type == "TypeFun") {
    throw new Error(Errors.ERROR_AMBIGUOUS_PANIC_TYPE);
  }
  return expected;
}

function processThrow(expr: Throw, expected: Type, ctx: Context): Type {
  if (expected.type == "TypeUnresolved") {
    throw new Error(Errors.ERROR_AMBIGUOUS_THROW_TYPE);
  }
  if (expected.type == "TypeFun" && !expected.parametersTypes[0]) {
    // console.log(expected.parametersTypes[0]);
    throw new Error(Errors.ERROR_AMBIGUOUS_THROW_TYPE);
  }
  if (exceptionTypes.length == 0) {
    throw new Error(Errors.ERROR_EXCEPTION_TYPE_NOT_DECLARED);
  }
  let throwType = typecheckExpr(expr.expr, TYPE_UNRESOLVED, ctx);
  if (!exceptionTypes.some((e) => checkTypeCompatibility(throwType, e))) {
    throw new Error(Errors.ERROR_UNEXPECTED_TYPE_FOR_EXPRESSION);
  }
  return expected;
}

function processTryCatch(expr: TryCatch, expected: Type, ctx: Context): Type {
  let exceptionType = exceptionTypes[exceptionTypes.length - 1];
  let tryType = typecheckExpr(expr.tryExpr, expected, ctx);

  const symbolsCopy = new Map(ctx.table);
  symbolsCopy.set((expr.pattern as PatternVar).name, exceptionType);

  const ctxWithCatch = {
    ...ctx,
    symbolTable: symbolsCopy,
  };

  typecheckExpr(expr.fallbackExpr, expected, ctxWithCatch);

  return tryType;
}

function processTryWith(expr: TryWith, expected: Type, ctx: Context): Type {
  let tryType = typecheckExpr(expr.tryExpr, expected, ctx);

  typecheckExpr(expr.fallbackExpr, expected, ctx);

  return tryType;
}

function verifyRecordFields(expected: Type, actual: Type) {
  if (expected.type === "TypeRecord" && actual.type === "TypeRecord") {
    if (expected.fieldTypes.length != actual.fieldTypes.length) {
      if (expected.fieldTypes.length > actual.fieldTypes.length) {
        throw Error(Errors.ERROR_MISSING_RECORD_FIELDS);
      } else {
        throw Error(Errors.ERROR_UNEXPECTED_RECORD_FIELDS);
      }
    }
    const expectedLabels = new Set(
      expected.fieldTypes.map((field) => field.label)
    );
    const actualLabels = new Set(actual.fieldTypes.map((field) => field.label));
    const allLabelsMatch =
      [...expectedLabels].every((label) => actualLabels.has(label)) &&
      [...actualLabels].every((label) => expectedLabels.has(label));

    if (!allLabelsMatch) {
      throw Error(Errors.ERROR_UNEXPECTED_RECORD_FIELDS);
    }
  }
}
