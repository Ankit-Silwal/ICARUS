import type { CodeQuestion, Language, TestCase } from "@icarus/contracts";

export interface Harness {
  source: string;
  tests: TestCase[];
}

function selectedTests(question: CodeQuestion, mode: "RUN" | "SUBMIT") {
  return question.tests.filter((test) =>
    mode === "RUN"
      ? test.visibility === "SAMPLE"
      : test.visibility === "HIDDEN",
  );
}

function cppType(value: unknown): string {
  if (Array.isArray(value))
    return `vector<${value.length ? cppType(value[0]) : "int"}>`;
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number")
    return Number.isInteger(value) ? "int" : "double";
  throw new Error("C++ harness supports JSON primitives and arrays.");
}
function cppLiteral(value: unknown): string {
  if (Array.isArray(value))
    return `${cppType(value)}{${value.map(cppLiteral).join(",")}}`;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  throw new Error("Unsupported C++ test value.");
}
function javaType(value: unknown): string {
  if (Array.isArray(value))
    return `${value.length ? javaType(value[0]) : "int"}[]`;
  if (typeof value === "string") return "String";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number")
    return Number.isInteger(value) ? "int" : "double";
  throw new Error("Java harness supports JSON primitives and arrays.");
}
function javaLiteral(value: unknown): string {
  if (Array.isArray(value))
    return `new ${javaType(value)}{${value.map(javaLiteral).join(",")}}`;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  throw new Error("Unsupported Java test value.");
}

function javascriptHarness(
  question: CodeQuestion,
  source: string,
  tests: TestCase[],
) {
  return `${source}\nconst __tests = ${JSON.stringify(tests.map(({ input, expected }) => ({ input, expected })))};\nconst __results = __tests.map(t => { try { return JSON.stringify(${question.functionName}(...t.input)) === JSON.stringify(t.expected); } catch { return false; } });\nconsole.log(JSON.stringify({ results: __results }));`;
}
function pythonHarness(
  question: CodeQuestion,
  source: string,
  tests: TestCase[],
) {
  return `import json\n${source}\n__tests = json.loads(${JSON.stringify(JSON.stringify(tests.map(({ input, expected }) => ({ input, expected }))))})\n__results = []\nfor __test in __tests:\n    try:\n        __results.append(${question.functionName}(*__test["input"]) == __test["expected"])\n    except Exception:\n        __results.append(False)\nprint(json.dumps({"results": __results}))`;
}
function cppHarness(question: CodeQuestion, source: string, tests: TestCase[]) {
  const cases = tests
    .map((test, testIndex) => {
      const args = Array.isArray(test.input) ? test.input : [test.input];
      const declarations = args
        .map(
          (value, index) =>
            `${cppType(value)} a${testIndex}_${index} = ${cppLiteral(value)};`,
        )
        .join("\n");
      const callArgs = args
        .map((_, index) => `a${testIndex}_${index}`)
        .join(",");
      return `${declarations}\nauto r${testIndex} = ${question.functionName}(${callArgs});\nbool ok${testIndex} = (r${testIndex} == ${cppLiteral(test.expected)});`;
    })
    .join("\n");
  return `#include <bits/stdc++.h>\nusing namespace std;\n${source}\nint main(){\n${cases}\ncout << "{\\"results\\":[";\n${tests.map((_, index) => `if(${index}) cout << ","; cout << (ok${index} ? "true" : "false");`).join("\n")}\ncout << "]}";\nreturn 0;\n}`;
}
function javaHarness(
  question: CodeQuestion,
  source: string,
  tests: TestCase[],
) {
  const cases = tests
    .map((test, index) => {
      const args = (Array.isArray(test.input) ? test.input : [test.input])
        .map(javaLiteral)
        .join(",");
      const expected = javaLiteral(test.expected);
      return `Object r${index} = instance.${question.functionName}(${args}); boolean ok${index} = java.util.Objects.deepEquals(r${index}, ${expected});`;
    })
    .join("\n");
  return `import java.util.*;\npublic class Main {\n${source}\npublic static void main(String[] args) { Main instance = new Main();\n${cases}\nStringBuilder out = new StringBuilder("{\\"results\\":[");\n${tests.map((_, index) => `if(${index}>0) out.append(','); out.append(ok${index});`).join("\n")}\nout.append("]}"); System.out.print(out); }\n}`;
}

export function buildHarness(
  question: CodeQuestion,
  language: Language,
  source: string,
  mode: "RUN" | "SUBMIT",
): Harness {
  const tests = selectedTests(question, mode);
  const builders = {
    javascript: javascriptHarness,
    python: pythonHarness,
    cpp: cppHarness,
    java: javaHarness,
  };
  return { source: builders[language](question, source, tests), tests };
}
