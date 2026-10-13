// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Shared reader engine for every generated `<package>.v1.generated.ts` module: a
// thin, schema-agnostic wrapper around Ajv (JSON Schema 2020-12) that turns
// validation failures into the same small, stable, safe-to-log error taxonomy
// as the Python runtime (P01C-24 "safe error/event sözlüğü") instead of raw Ajv
// error objects.
//
// This file has no schema-specific content and is generated identically into
// every TS consumer (api-gateway, youtorch-ui) so it stays under the same
// `--check` drift guard as the per-package modules -- there is no shared npm
// workspace between the two apps to import a single copy from.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";

const VERSION_FIELD = "schema_version";

export type SafeContractErrorKind =
  | "unknown_document"
  | "unsupported_schema_version"
  | "unsupported_value"
  | "schema_violation";

export interface SafeContractError {
  readonly kind: SafeContractErrorKind;
  readonly document: string;
  readonly path: string;
  readonly keyword?: string;
  readonly message: string;
  readonly allowed?: readonly (string | number)[];
}

export type ContractReadResult<T = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly SafeContractError[] };

export interface ContractPackageReaderOptions {
  readonly package: string;
  readonly schemas: Record<string, object>;
  readonly documentTypes: readonly string[];
  readonly schemaVersions: Readonly<Record<string, readonly (string | number)[]>>;
  readonly safeDictionary: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

export class ContractPackageReader {
  private readonly ajv: Ajv2020;
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(private readonly options: ContractPackageReaderOptions) {
    this.ajv = new Ajv2020({
      schemas: Object.values(options.schemas),
      // Binary floats make a naive `multipleOf` check on fractional credit
      // amounts (e.g. 0.0001) fail for otherwise-exact values; this option
      // makes Ajv tolerate floating point rounding the same way the Python
      // reader does by parsing fixtures as Decimal.
      multipleOfPrecision: 9,
      allErrors: true,
      strict: false,
    });
    addFormats(this.ajv);
  }

  private validatorFor(document: string): ValidateFunction {
    let validator = this.validators.get(document);
    if (!validator) {
      const schema = (this.options.schemas as Record<string, { $id?: string }>)[`${document}.schema.json`];
      validator = this.ajv.getSchema(schema.$id as string) ?? this.ajv.compile(schema);
      this.validators.set(document, validator);
    }
    return validator;
  }

  read<T = unknown>(document: string, payload: unknown): ContractReadResult<T> {
    if (!this.options.documentTypes.includes(document)) {
      return {
        ok: false,
        errors: [
          {
            kind: "unknown_document",
            document,
            path: "",
            message: `${document} is not a document type of package ${this.options.package}`,
          },
        ],
      };
    }
    const validate = this.validatorFor(document);
    const valid = validate(payload);
    if (valid) {
      return { ok: true, value: payload as T };
    }
    const errors = (validate.errors ?? []).map((error) => this.classify(document, error));
    return { ok: false, errors };
  }

  private classify(document: string, error: ErrorObject): SafeContractError {
    const path = error.instancePath.replace(/^\//, "");
    const fieldName = path.split("/").filter(Boolean).pop();
    if (error.keyword === "const" && fieldName === VERSION_FIELD) {
      return {
        kind: "unsupported_schema_version",
        document,
        path,
        keyword: "const",
        message: "schema_version is not a version this reader supports",
        allowed: this.options.schemaVersions[document] ?? [],
      };
    }
    const dictionary = this.options.safeDictionary[document];
    if (error.keyword === "enum" && fieldName && dictionary && dictionary[fieldName]) {
      return {
        kind: "unsupported_value",
        document,
        path,
        keyword: "enum",
        message: `${fieldName} is not one of the known safe dictionary values`,
        allowed: dictionary[fieldName],
      };
    }
    return {
      kind: "schema_violation",
      document,
      path,
      keyword: error.keyword,
      message: `${error.keyword} violated at /${path}`,
    };
  }
}
