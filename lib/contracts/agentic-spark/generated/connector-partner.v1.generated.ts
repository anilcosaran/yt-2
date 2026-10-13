// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/connector-partner/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-partner/v1/common.schema.json",
    "title": "connector_partner_common_v1",
    "description": "Shared definitions for the P01C-27 connector-partner package (external production tools policy, Q63). Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "BillingMode": {
        "description": "youtorch_credits (preferred): the user pays Youtorch credits and the platform settles with the partner; plan line and receipt are normal. partner_account: charged to the user's own partner account; the plan line says 'charged to an external account' and revenue share is reported.",
        "enum": [
          "youtorch_credits",
          "partner_account"
        ]
      },
      "MediaKind": {
        "enum": [
          "image",
          "video",
          "audio",
          "voice",
          "avatar"
        ]
      },
      "RemoteFileRef": {
        "description": "connectors/MIMARI \u00a72 RemoteFileRef of a partner output: an untrusted hint the Storage import resolves and probes. A URL is never an asset, a timeline clip or a manifest entry.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "connection_id",
          "provider_file_id"
        ],
        "properties": {
          "connection_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "provider_file_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256
          },
          "provider_version": {
            "type": "string",
            "maxLength": 128
          },
          "mime_hint": {
            "type": "string",
            "pattern": "^(image|video|audio)/[A-Za-z0-9.+-]{1,64}$"
          },
          "size_hint_bytes": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "Requirement": {
        "description": "Rules every partner generation obeys like Youtorch's own production (MCP \u00a78): tenant park/concurrency admission, quality check before attach, provenance (model, partner, receipt) and import into Storage.",
        "enum": [
          "park_admission",
          "quality_check",
          "provenance",
          "storage_import"
        ]
      }
    }
  },
  "media-result.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-partner/v1/media-result.schema.json",
    "title": "connector_partner_media_result_v1",
    "description": "P01C-27 result a partner media_generate operation must yield before anything reaches a project (MCP \u00a78: park/QC/provenance and Storage import; connectors/MIMARI \u00a74). Outputs are RemoteFileRefs only: the Storage import (existing Storage import/copy) acquires, checksums and probes them; QC runs before attach; provenance names the model, the partner contract and the receipt. Settlement follows the billing mode: youtorch_credits needs the Billing allocation, partner_account the partner charge ref and the revenue-share record.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "logical_operation_id",
      "definition_id",
      "tool_revision_id",
      "contract_ref",
      "billing_mode",
      "park",
      "outputs",
      "provenance",
      "quality_check",
      "storage_import",
      "settlement"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_partner_media_result_v1"
      },
      "logical_operation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "definition_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tool_revision_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "contract_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "billing_mode": {
        "$ref": "common.schema.json#/$defs/BillingMode"
      },
      "park": {
        "description": "Tenant park/concurrency admission the generation ran under (tenant-park plan).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "admission_ref"
        ],
        "properties": {
          "admission_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "outputs": {
        "type": "array",
        "minItems": 1,
        "maxItems": 16,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "media_kind",
            "remote_file"
          ],
          "properties": {
            "media_kind": {
              "$ref": "common.schema.json#/$defs/MediaKind"
            },
            "remote_file": {
              "$ref": "common.schema.json#/$defs/RemoteFileRef"
            }
          }
        }
      },
      "provenance": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "partner_definition_id",
          "model_id",
          "receipt_ref",
          "generated_at"
        ],
        "properties": {
          "partner_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "model_id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9._:/-]{1,128}$"
          },
          "model_version": {
            "type": "string",
            "maxLength": 128
          },
          "receipt_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "generated_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          }
        }
      },
      "quality_check": {
        "description": "QC runs on the imported Storage copy before any attach; a partner result is never born passed.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status"
        ],
        "properties": {
          "status": {
            "const": "pending"
          }
        }
      },
      "storage_import": {
        "description": "Each output is imported through the Storage import (idempotent per operation + output index); until ready nothing is attached to a timeline.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status"
        ],
        "properties": {
          "status": {
            "const": "required"
          }
        }
      },
      "settlement": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "payer"
        ],
        "properties": {
          "payer": {
            "$ref": "common.schema.json#/$defs/BillingMode"
          },
          "allocation_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "partner_charge_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "revenue_share_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "billing_mode": {
              "const": "youtorch_credits"
            }
          },
          "required": [
            "billing_mode"
          ]
        },
        "then": {
          "properties": {
            "settlement": {
              "properties": {
                "payer": {
                  "const": "youtorch_credits"
                }
              },
              "required": [
                "allocation_ref"
              ],
              "not": {
                "required": [
                  "partner_charge_ref"
                ]
              }
            }
          }
        },
        "else": {
          "properties": {
            "settlement": {
              "properties": {
                "payer": {
                  "const": "partner_account"
                }
              },
              "required": [
                "partner_charge_ref",
                "revenue_share_ref"
              ],
              "not": {
                "required": [
                  "allocation_ref"
                ]
              }
            }
          }
        }
      }
    ]
  },
  "production-terms.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-partner/v1/production-terms.schema.json",
    "title": "connector_partner_production_terms_v1",
    "description": "P01C-27 terms under which a contracted partner's media_generate tool is offered (Q63, MCP \u00a78): the platform catalog registration (catalog_remote_mcp or managed_mcp), the contract and revenue-share record, the billing mode and the plan line it implies, and the production rules the result must follow. Custom MCP and uncontracted catalog entries have no terms: their generation tools are blocked (tool_policy_blocked).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "definition_id",
      "profile_kind",
      "contract_ref",
      "revenue_share_ref",
      "billing_mode",
      "plan_line",
      "requirements"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_partner_production_terms_v1"
      },
      "definition_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "profile_kind": {
        "enum": [
          "catalog_remote_mcp",
          "managed_mcp"
        ]
      },
      "contract_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "revenue_share_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "billing_mode": {
        "$ref": "common.schema.json#/$defs/BillingMode"
      },
      "plan_line": {
        "description": "What the plan card shows for the partner step.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "payer",
          "charge_label"
        ],
        "properties": {
          "payer": {
            "enum": [
              "youtorch_credits",
              "partner_account"
            ]
          },
          "charge_label": {
            "enum": [
              "youtorch_credits",
              "charged_to_external_account"
            ]
          }
        }
      },
      "requirements": {
        "type": "array",
        "minItems": 4,
        "maxItems": 4,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/Requirement"
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "billing_mode": {
              "const": "youtorch_credits"
            }
          },
          "required": [
            "billing_mode"
          ]
        },
        "then": {
          "properties": {
            "plan_line": {
              "properties": {
                "payer": {
                  "const": "youtorch_credits"
                },
                "charge_label": {
                  "const": "youtorch_credits"
                }
              }
            }
          }
        },
        "else": {
          "properties": {
            "plan_line": {
              "properties": {
                "payer": {
                  "const": "partner_account"
                },
                "charge_label": {
                  "const": "charged_to_external_account"
                }
              }
            }
          }
        }
      }
    ]
  }
} as const;

export const DOCUMENT_TYPES = ["media-result", "production-terms"] as const;
export type DocumentType = "media-result" | "production-terms";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "media-result": [
    "connector_partner_media_result_v1"
  ],
  "production-terms": [
    "connector_partner_production_terms_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type MediaResult = {
    readonly "schema_version": "connector_partner_media_result_v1";
    readonly "logical_operation_id": string;
    readonly "definition_id": string;
    readonly "tool_revision_id": string;
    readonly "contract_ref": string;
    readonly "billing_mode": "youtorch_credits" | "partner_account";
    readonly "park": {
    readonly "admission_ref": string;
  };
    readonly "outputs": readonly ({
    readonly "media_kind": "image" | "video" | "audio" | "voice" | "avatar";
    readonly "remote_file": unknown;
  })[];
    readonly "provenance": {
    readonly "partner_definition_id": string;
    readonly "model_id": string;
    readonly "model_version"?: string;
    readonly "receipt_ref": string;
    readonly "generated_at": string;
  };
    readonly "quality_check": {
    readonly "status": "pending";
  };
    readonly "storage_import": {
    readonly "status": "required";
  };
    readonly "settlement": {
    readonly "payer": "youtorch_credits" | "partner_account";
    readonly "allocation_ref"?: string;
    readonly "partner_charge_ref"?: string;
    readonly "revenue_share_ref"?: string;
  };
  };
export type ProductionTerms = {
    readonly "schema_version": "connector_partner_production_terms_v1";
    readonly "definition_id": string;
    readonly "profile_kind": "catalog_remote_mcp" | "managed_mcp";
    readonly "contract_ref": string;
    readonly "revenue_share_ref": string;
    readonly "billing_mode": "youtorch_credits" | "partner_account";
    readonly "plan_line": {
    readonly "payer": "youtorch_credits" | "partner_account";
    readonly "charge_label": "youtorch_credits" | "charged_to_external_account";
  };
    readonly "requirements": readonly ("park_admission" | "quality_check" | "provenance" | "storage_import")[];
  };

export const reader = new ContractPackageReader({
  package: "connector-partner",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
